import { z } from 'zod';
import { type YearTotal, EVENTS, MIGRATIONS, populationGroups, manifestSchema, nationalSchema, prefecturesSchema, sourceSchema, monthSchema } from '../src/types/statistics';
import { addMonths, monthStart, secondsInMonth } from '../src/lib/time';
import { PREFECTURES } from '../src/lib/prefectures';
import type { Dataset } from './dataset';
const counts = z.object({ birth: z.number().int().nonnegative(), death: z.number().int().nonnegative(), marriage: z.number().int().nonnegative(), divorce: z.number().int().nonnegative() });
function validateYear(year: Record<string, YearTotal> | undefined, month: string, latest: string, keys: readonly string[]) {
  if (!year) throw new Error('年累計の月が欠けています');
  const through = latest < `${month.slice(0, 4)}-01` || month.endsWith('-01') ? null : latest < month ? latest : addMonths(month, -1);
  for (const key of keys) {
    const value = year[key];
    if (!value || value.officialThrough !== through) throw new Error('年累計の公表済み期間が不正です');
    if (!through && value.officialCount !== 0) throw new Error('公表値のない年に原値が混在しています');
    if (month.endsWith('-01') && value.estimatedBeforeMonth !== 0) throw new Error('年累計が元日にリセットされていません');
  }
}
export function validateDataset(data: Dataset): void {
  manifestSchema.parse(data.manifest); nationalSchema.parse(data.national);
  prefecturesSchema.parse({ generationId: data.manifest.generationId, prefectures: data.prefectures });
  if (data.national.generationId !== data.manifest.generationId) throw new Error('JSONの世代が一致しません');
  for (const vital of [data.national.vital, ...Object.values(data.prefectures).map(p => p.vital)]) {
    if (vital.yearToDate) for (const month of data.manifest.forecastMonths) validateYear(vital.yearToDate[month], month, vital.source.sourcePeriod, EVENTS);
    if (vital.source.sourcePeriod !== data.manifest.vital.latestMonth) throw new Error('人口動態の基準月が一致しません');
    for (const month of data.manifest.forecastMonths) for (const key of EVENTS) {
      const model = vital.months[month]?.[key];
      if (!model || Math.abs(model.ratePerSecond * secondsInMonth(month) - model.estimatedMonthCount) > 0.0001) throw new Error('月別速度が不正です');
    }
  }
  const hasExtended = Boolean(data.national.breakdown || data.national.migration || Object.values(data.prefectures).some(p => p.population || p.migration));
  if (hasExtended) {
    const breakdown = data.national.breakdown;
    if (!breakdown || !data.national.migration) throw new Error('拡張統計が不完全です');
    const sources = [breakdown.source];
    if (breakdown.groups.total.base !== data.national.population.base || breakdown.groups.total.baseDate !== data.national.population.baseDate) throw new Error('総人口と人口内訳の基準が一致しません');
    const ageLabels = ['総数', ...Array.from({ length: 21 }, (_, i) => i === 20 ? '100歳以上' : `${i * 5}～${i * 5 + 4}歳`)];
    const keys = new Set(breakdown.rows.map(r => `${r.group}/${r.sex}/${r.age}`));
    if (keys.size !== 198 || breakdown.rows.length !== 198) throw new Error('人口内訳の欠損・重複');
    for (const g of populationGroups) {
      const model = breakdown.groups[g];
      sources.push(model.source);
      if (model.source.sourcePeriod !== breakdown.source.sourcePeriod || model.baseDate !== data.national.population.baseDate || model.yearAgoDate !== data.national.population.yearAgoDate) throw new Error('人口内訳の基準月が一致しません');
      const rate = (model.base - model.yearAgo) / ((Date.parse(model.baseDate) - Date.parse(model.yearAgoDate)) / 1000);
      if (Math.abs(rate - model.ratePerSecond) > 1e-12) throw new Error('人口内訳の速度が不正です');
      for (const sex of ['男女計', '男', '女']) for (const age of ageLabels) if (!keys.has(`${g}/${sex}/${age}`)) throw new Error('人口内訳の分類が不完全です');
    }
    for (const region of [data.national, ...Object.values(data.prefectures)]) {
      const migration = region.migration;
      if (!migration) throw new Error('人口移動の地域が欠けています');
      if (migration.yearToDate) for (const month of data.manifest.forecastMonths) validateYear(migration.yearToDate[month], month, migration.domesticSource.sourcePeriod, MIGRATIONS);
      sources.push(migration.domesticSource, migration.internationalSource);
      if (migration.domesticSource.sourcePeriod !== migration.internationalSource.sourcePeriod) throw new Error('国内外移動の基準月が一致しません');
      for (const m of data.manifest.forecastMonths) for (const kind of MIGRATIONS) {
        const model = migration.months[m]?.[kind];
        if (!model || Math.abs(model.ratePerSecond * secondsInMonth(m) - model.estimatedMonthCount) > .0001) throw new Error('人口移動の月別速度が不正です');
      }
    }
    for (const prefecture of Object.values(data.prefectures)) {
      const model = prefecture.population;
      if (!model) throw new Error('都道府県参考人口が欠けています');
      sources.push(model.source, model.vitalSource, model.domesticSource, model.internationalSource);
      if (Date.parse(model.officialBaseDate) !== monthStart(model.source.sourcePeriod)) throw new Error('参考人口の公式基準日が不正です');
      if (model.vitalSource.sourcePeriod !== prefecture.vital.source.sourcePeriod || model.domesticSource.sourcePeriod !== prefecture.migration!.domesticSource.sourcePeriod || model.internationalSource.sourcePeriod !== prefecture.migration!.internationalSource.sourcePeriod) throw new Error('参考人口の出典月が不一致です');
      for (const m of data.manifest.forecastMonths) {
        const current = model.months[m];
        if (!current) throw new Error('参考人口の月が欠けています');
        const next = model.months[addMonths(m, 1)];
        if (next && Math.abs(next.baseValue - current.baseValue - current.ratePerSecond * secondsInMonth(m)) > .001) throw new Error('参考人口が月境界で不連続です');
      }
    }
    if (data.manifest.mode === 'official' && sources.some(s => s.status === 'fixture')) throw new Error('拡張統計にfixtureが混在しています');
  }
  const p = data.national.population;
  if (p.source.sourcePeriod !== data.manifest.population.latestFinalMonth || p.baseDate.slice(0, 7) !== p.source.sourcePeriod || p.yearAgoDate.slice(0, 7) !== addMonths(p.source.sourcePeriod, -12)) throw new Error('人口の基準日が不正です');
  const expected = (p.base - p.yearAgo) / ((Date.parse(p.baseDate) - Date.parse(p.yearAgoDate)) / 1000);
  if (Math.abs(p.ratePerSecond - expected) > 1e-12) throw new Error('人口の速度が不正です');
  const required = ['00', ...PREFECTURES.map(p => p.code)];
  if (data.history.vital.length < 60) throw new Error('履歴は60か月以上必要です');
  data.history.vital.forEach((row, i) => {
    monthSchema.parse(row.month); sourceSchema.parse(row.source);
    if (i && row.month !== addMonths(data.history.vital[i - 1].month, 1)) throw new Error('履歴月が連続していません');
    if (row.source.sourcePeriod !== row.month) throw new Error('履歴の出典月が不正です');
    for (const code of required) counts.parse(row.regions[code]);
  });
  if (data.history.population.length < 60) throw new Error('人口履歴は60か月以上必要です');
  data.history.population.forEach((row, i) => {
    monthSchema.parse(row.month); sourceSchema.parse(row.source); z.number().int().positive().parse(row.value);
    if (row.source.sourcePeriod !== row.month || (i && row.month !== addMonths(data.history.population[i - 1].month, 1))) throw new Error('人口履歴の年月が不正です');
  });
  if (data.history.population.at(-1)?.value !== p.base || data.history.population.at(-1)?.month !== p.source.sourcePeriod) throw new Error('人口の原値とモデルが不一致です');
  if (data.manifest.mode === 'official') {
    if (p.source.status !== 'final' || data.national.vital.source.status !== 'provisional') throw new Error('実データの原値区分が不正（fixture等）です');
    const sources = [p.source, ...data.history.population.map(r => r.source), ...data.history.vital.map(r => r.source), data.national.vital.source, ...Object.values(data.prefectures).map(r => r.vital.source)];
    if (sources.some(s => s.status === 'fixture')) throw new Error('実データにfixtureが混在しています');
  }
}
export function validateChange(old: Dataset, next: Dataset): void {
  if (old.manifest.mode !== next.manifest.mode) return;
  if (next.manifest.population.latestFinalMonth < old.manifest.population.latestFinalMonth || next.manifest.vital.latestMonth < old.manifest.vital.latestMonth) throw new Error('統計の基準月が後退しています');
  const check = (a: number, b: number, label: string) => { if (a === 0 ? b !== 0 : Math.abs(b - a) / a >= .2) throw new Error(`前回比20%以上の変化: ${label}`); };
  check(old.national.population.base, next.national.population.base, '全国人口');
  for (const g of populationGroups) if (old.national.breakdown && next.national.breakdown) check(old.national.breakdown.groups[g].base, next.national.breakdown.groups[g].base, g);
  for (const [code, region] of [['00', next.national], ...Object.entries(next.prefectures)] as const) {
    const before = code === '00' ? old.national : old.prefectures[code];
    if (before?.migration && region.migration) {
      if (region.migration.domesticSource.sourcePeriod < before.migration.domesticSource.sourcePeriod || region.migration.internationalSource.sourcePeriod < before.migration.internationalSource.sourcePeriod) throw new Error('人口移動の基準月が後退しています');
      for (const [month, models] of Object.entries(region.migration.months)) if (before.migration.months[month]) for (const key of MIGRATIONS) check(before.migration.months[month][key].estimatedMonthCount, models[key].estimatedMonthCount, `${code}/${month}/${key}`);
    }
  }
  for (const [code, region] of Object.entries(next.prefectures)) {
    const before = old.prefectures[code]?.population;
    if (before && region.population) for (const [month, model] of Object.entries(region.population.months)) if (before.months[month]) check(before.months[month].baseValue, model.baseValue, `参考人口/${code}/${month}`);
  }
  // Compare the same forecast month: do not flag ordinary month-to-month seasonality.
  for (const [code, vital] of [['00', next.national.vital], ...Object.entries(next.prefectures).map(([code, p]) => [code, p.vital] as const)] as const) {
    const before = code === '00' ? old.national.vital : old.prefectures[code]?.vital;
    if (!before) continue;
    for (const [month, models] of Object.entries(vital.months)) if (before.months[month]) for (const key of EVENTS) check(before.months[month][key].estimatedMonthCount, models[key].estimatedMonthCount, `${code}/${month}/${key}`);
  }
}
