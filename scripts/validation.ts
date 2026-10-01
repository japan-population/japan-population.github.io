import { z } from 'zod';
import { EVENTS, manifestSchema, nationalSchema, prefecturesSchema, sourceSchema, monthSchema } from '../src/types/statistics';
import { addMonths, secondsInMonth } from '../src/lib/time';
import { PREFECTURES } from '../src/lib/prefectures';
import type { Dataset } from './dataset';
const counts = z.object({ birth: z.number().int().nonnegative(), death: z.number().int().nonnegative(), marriage: z.number().int().nonnegative(), divorce: z.number().int().nonnegative() });
export function validateDataset(data: Dataset): void {
  manifestSchema.parse(data.manifest); nationalSchema.parse(data.national);
  prefecturesSchema.parse({ generationId: data.manifest.generationId, prefectures: data.prefectures });
  if (data.national.generationId !== data.manifest.generationId) throw new Error('JSONの世代が一致しません');
  for (const vital of [data.national.vital, ...Object.values(data.prefectures).map(p => p.vital)]) {
    if (vital.source.sourcePeriod !== data.manifest.vital.latestMonth) throw new Error('人口動態の基準月が一致しません');
    for (const month of data.manifest.forecastMonths) for (const key of EVENTS) {
      const model = vital.months[month]?.[key];
      if (!model || Math.abs(model.ratePerSecond * secondsInMonth(month) - model.estimatedMonthCount) > 0.0001) throw new Error('月別速度が不正です');
    }
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
  // Compare the same forecast month: do not flag ordinary month-to-month seasonality.
  for (const [code, vital] of [['00', next.national.vital], ...Object.entries(next.prefectures).map(([code, p]) => [code, p.vital] as const)] as const) {
    const before = code === '00' ? old.national.vital : old.prefectures[code]?.vital;
    if (!before) continue;
    for (const [month, models] of Object.entries(vital.months)) if (before.months[month]) for (const key of EVENTS) check(before.months[month][key].estimatedMonthCount, models[key].estimatedMonthCount, `${code}/${month}/${key}`);
  }
}
