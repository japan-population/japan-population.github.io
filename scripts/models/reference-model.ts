import { EVENTS, MIGRATIONS, type Migration, type MigrationCounts, type PopulationObservation, type ReferencePopulation, type VitalObservation } from '../../src/types/statistics';
import { addMonths, monthStart, secondsInMonth } from '../../src/lib/time';
import { eventModel } from './event-model';
import type { MigrationHistory } from '../sources/migration';
export function migrationModel(history: MigrationHistory, code: string, month: string, allowOlderSeason = false): Migration['months'][string] {
  // Reuse the same checked seasonal model for the four movement series.
  const rows: VitalObservation[] = history.rows.map(r => ({ month: r.month, source: { ...history.domesticSource, sourcePeriod: r.month }, regions: { [code]: Object.fromEntries(EVENTS.map((key, i) => [key, r.regions[code]?.[MIGRATIONS[i]]])) as VitalObservation['regions'][string] } }));
  const model = eventModel(rows, code, month, allowOlderSeason);
  return Object.fromEntries(MIGRATIONS.map((key, i) => [key, model[EVENTS[i]]])) as Migration['months'][string];
}
export function referenceModel(base: PopulationObservation, vital: VitalObservation[], migration: MigrationHistory, code: string, forecastMonths: string[]): ReferencePopulation {
  const months: ReferencePopulation['months'] = {};
  let value = base.value;
  const latestVital = [...vital].sort((a,b) => a.month.localeCompare(b.month)).at(-1)!;
  const last = [...forecastMonths].sort().at(-1)!;
  if (base.month > forecastMonths[0]) throw new Error('都道府県の基準日が予測対象より未来です');
  for (let m = base.month; m <= last; m = addMonths(m, 1)) {
    const actualVital = vital.find(r => r.month === m)?.regions[code];
    if (!actualVital && m <= latestVital.month) throw new Error('参考人口の人口動態履歴に欠損があります');
    const v = actualVital ?? Object.fromEntries(Object.entries(eventModel(vital, code, m)).map(([k, model]) => [k, model.estimatedMonthCount])) as VitalObservation['regions'][string];
    const actualMigration = migration.rows.find(r => r.month === m)?.regions[code];
    if (!actualMigration && m <= migration.domesticSource.sourcePeriod) throw new Error('参考人口の人口移動履歴に欠損があります');
    const moves = actualMigration ?? Object.fromEntries(Object.entries(migrationModel(migration, code, m)).map(([k, model]) => [k, model.estimatedMonthCount])) as MigrationCounts;
    const delta = v.birth - v.death + moves.domesticIn - moves.domesticOut + moves.internationalIn - moves.internationalOut;
    if (forecastMonths.includes(m)) months[m] = { baseValue: value, ratePerSecond: delta / secondsInMonth(m) };
    value += delta;
    if (value <= 0) throw new Error('参考人口が0以下になりました');
  }
  return { officialBase: base.value, officialBaseDate: new Date(monthStart(base.month)).toISOString(), source: base.source, vitalSource: latestVital.source, domesticSource: migration.domesticSource, internationalSource: migration.internationalSource, months };
}
