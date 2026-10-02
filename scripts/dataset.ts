import type { OfficialRegions } from './sources/census-regions';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PREFECTURES } from '../src/lib/prefectures';
import { addMonths, monthKey } from '../src/lib/time';
import { type PopulationObservation, type VitalObservation, type DashboardData } from '../src/types/statistics';
import { groupEvents } from './models/group-events';
import type { BirthDeathRow } from './sources/national-events';
import type { PopulationGroup } from '../src/types/statistics';
import { yearModel } from './models/year-model';
import { EVENTS, MIGRATIONS, mapRegionsSchema } from '../src/types/statistics';
import type { Breakdown } from '../src/types/statistics';
import type { MigrationHistory } from './sources/migration';
import { migrationModel, referenceModel } from './models/reference-model';
import { populationModel } from './models/population-model';
import { eventModel } from './models/event-model';
import { validateDataset, validateChange } from './validation';
export type Dataset = DashboardData & { history: { population: PopulationObservation[]; vital: VitalObservation[] } };
// Retrieval timestamps alone must not create a daily data commit.
export function semanticJSON(value: unknown): string {
  return JSON.stringify(value, (key, v: unknown) => {
    if (['retrievedAt', 'generatedAt', 'generationId'].includes(key)) return undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    return v;
  });
}
export function buildDataset(population: PopulationObservation[], vital: VitalObservation[], mode: 'fixture' | 'official', now: number, extra?: { breakdown: Breakdown; migration: MigrationHistory; bases: Record<string, PopulationObservation>; japaneseBases?: Record<string, PopulationObservation>; officialRegions?: OfficialRegions; nationalEvents?: BirthDeathRow[]; migrationsByGroup?: Record<PopulationGroup, MigrationHistory> }): Dataset {
  const current = monthKey(now);
  const months = [0, 1, 2].map(n => addMonths(current, n));
  const sorted = [...vital].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted.at(-1);
  if (!latest || vital.length < 60) throw new Error('最低60か月の人口動態履歴が必要です');
  for (let i = 1; i < sorted.length; i++) if (sorted[i].month !== addMonths(sorted[i - 1].month, 1)) throw new Error('人口動態履歴に欠損または重複があります');
  const makeVital = (region: string) => ({ source: latest.source,
    months: Object.fromEntries(months.map(m => [m, eventModel(sorted, region, m)])),
    yearToDate: Object.fromEntries(months.map(m => [m, yearModel(EVENTS, m, latest.month,
      month => sorted.find(r => r.month === month)?.regions[region],
      month => { const models = eventModel(sorted, region, month, true); return Object.fromEntries(EVENTS.map(k => [k, models[k].estimatedMonthCount])) as Record<typeof EVENTS[number], number>; })])),
  });
  const national = { generationId: '', population: populationModel(population), vital: makeVital('00') };
  const prefectures = Object.fromEntries(PREFECTURES.map(p => [p.code, { ...p, vital: makeVital(p.code) }]));
  const result: Dataset = { manifest: { schemaVersion: 1, generationId: '', generatedAt: new Date(now).toISOString(), mode, population: { latestFinalMonth: national.population.source.sourcePeriod }, vital: { latestMonth: latest.month }, forecastMonths: months, historyStart: sorted[0].month }, national, prefectures, history: { population, vital: sorted } };
  if (extra) {
    result.national.breakdown = extra.breakdown;
    if (extra.breakdown.groups.total.base !== result.national.population.base || extra.breakdown.groups.total.baseDate !== result.national.population.baseDate) throw new Error('人口内訳と総人口が一致しません');
    const makeMigration = (code: string) => ({ domesticSource: extra.migration.domesticSource, internationalSource: extra.migration.internationalSource, months: Object.fromEntries(months.map(m => [m, migrationModel(extra.migration, code, m)])),
      yearToDate: Object.fromEntries(months.map(m => [m, yearModel(MIGRATIONS, m, extra.migration.domesticSource.sourcePeriod,
        month => extra.migration.rows.find(r => r.month === month)?.regions[code],
        month => { const models = migrationModel(extra.migration, code, month, true); return Object.fromEntries(MIGRATIONS.map(k => [k, models[k].estimatedMonthCount])) as Record<typeof MIGRATIONS[number], number>; })])),
    });
    result.national.migration = makeMigration('00');
    if (extra.nationalEvents && extra.migrationsByGroup) result.national.eventsByGroup = groupEvents(result.national.vital, extra.nationalEvents, extra.migrationsByGroup, months);
    for (const p of Object.values(result.prefectures)) {
      if (extra.japaneseBases) {
        const total = extra.bases[p.code], japanese = extra.japaneseBases[p.code];
        if (!japanese || japanese.month !== total.month || japanese.value > total.value) throw new Error('地域人口の国籍別データが不整合です');
        p.officialPopulation = {total:{value:total.value,source:total.source},japanese:{value:japanese.value,source:japanese.source},foreign:{value:total.value-japanese.value,source:{...total.source,scope:'公表された総人口から日本人人口を差し引いた参考値。双方の公表単位は千人。'},derived:true}};
      }
      const official = extra.officialRegions?.[p.code];
      if (official && (!p.officialPopulation || official.total.source.sourcePeriod >= p.officialPopulation.total.source.sourcePeriod)) p.officialPopulation = official;
      p.migration = makeMigration(p.code);
      p.population = referenceModel(extra.bases[p.code], vital, extra.migration, p.code, months);
    }
  }
  const id = createHash('sha256').update(semanticJSON(result)).digest('hex').slice(0, 16);
  result.manifest.generationId = id;
  result.national.generationId = id;
  validateDataset(result);
  return result;
}
export async function readDataset(directory: string): Promise<Dataset> {
  const read = async (file: string) => JSON.parse(await readFile(resolve(directory, file), 'utf8')) as unknown;
  const [manifest, national, pref, hn, hp] = await Promise.all(['manifest.json', 'national.json', 'prefectures.json', 'history/national.json', 'history/prefectures.json'].map(read));
  const p = pref as { generationId: string; prefectures: Dataset['prefectures'] };
  const n = hn as { generationId: string; population: PopulationObservation[]; vital: VitalObservation[] };
  const h = hp as { generationId: string; vital: VitalObservation[] };
  const result = { manifest, national, prefectures: p.prefectures, history: { population: n.population, vital: h.vital.map(row => ({ ...row, regions: { ...row.regions, '00': n.vital.find(v => v.month === row.month)!.regions['00'] } })) } } as Dataset;
  if ([p.generationId, n.generationId, h.generationId].some(id => id !== result.manifest.generationId)) throw new Error('JSONの世代が一致しません');
  validateDataset(result);
  try {
    const regions = mapRegionsSchema.parse(await read('regions.json'));
    if (regions.generationId !== result.manifest.generationId) throw new Error('地域JSONの世代が一致しません');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return result;
}
export async function publishDataset(data: Dataset, directory = resolve('public/data')): Promise<boolean> {
  validateDataset(data);
  let previous: Dataset | undefined;
  try { previous = await readDataset(directory); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  if (previous && semanticJSON(previous) === semanticJSON(data)) return false;
  if (previous) validateChange(previous, data);
  const stage = resolve(dirname(directory), `.data-stage-${process.pid}`);
  const backup = resolve(dirname(directory), `.data-backup-${process.pid}`);
  await mkdir(resolve(stage, 'history'), { recursive: true });
  const id = data.manifest.generationId;
  const files: Record<string, unknown> = {
    'manifest.json': data.manifest, 'national.json': data.national,
    'regions.json': mapRegionsSchema.parse({generationId:id,prefectures:Object.fromEntries(Object.values(data.prefectures).map(p=>[p.code,{code:p.code,name:p.name,officialPopulation:p.officialPopulation??(p.population?{total:{value:p.population.officialBase,source:p.population.source}}:undefined)}]))}),
    'prefectures.json': { generationId: id, prefectures: data.prefectures },
    'history/national.json': { generationId: id, population: data.history.population, vital: data.history.vital.map(row => ({ ...row, regions: { '00': row.regions['00'] } })) },
    'history/prefectures.json': { generationId: id, vital: data.history.vital.map(row => ({ ...row, regions: Object.fromEntries(Object.entries(row.regions).filter(([key]) => key !== '00')) })) },
  };
  try {
    for (const [file, value] of Object.entries(files)) await writeFile(resolve(stage, file), JSON.stringify(value) + '\n');
    await readDataset(stage);
    let moved = false;
    try { await rename(directory, backup); moved = true; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    try { await rename(stage, directory); } catch (e) { if (moved) await rename(backup, directory); throw e; }
    if (moved) await rm(backup, { recursive: true });
  } finally { await rm(stage, { recursive: true, force: true }); }
  return true;
}
