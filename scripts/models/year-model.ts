import { addMonths, monthStart } from '../../src/lib/time';
import type { YearTotal } from '../../src/types/statistics';
/** Published months use original counts; only unpublished months use forecasts. */
export function yearModel<K extends string>(keys: readonly K[], target: string, latest: string, actual: (month: string) => Record<K, number> | undefined, forecast: (month: string) => Record<K, number>): Record<K, YearTotal> {
  const result = Object.fromEntries(keys.map(k => [k, { officialCount: 0, estimatedBeforeMonth: 0, officialThrough: null, estimatedYearCount: 0, averagePerDay: 0 }])) as Record<K, YearTotal>;
  for (let month = `${target.slice(0, 4)}-01`; month <= `${target.slice(0, 4)}-12`; month = addMonths(month, 1)) {
    const published = month <= latest;
    const values = published ? actual(month) : forecast(month);
    if (!values) throw new Error(`年累計の公表済み月が欠損: ${month}`);
    for (const key of keys) {
      const n = values[key];
      if (!Number.isFinite(n) || n < 0 || (published && !Number.isSafeInteger(n))) throw new Error('年累計の原値が不正です');
      result[key].estimatedYearCount! += n;
      if (month >= target) continue;
      if (published) { result[key].officialCount += n; result[key].officialThrough = month; }
      else result[key].estimatedBeforeMonth += n;
    }
  }
  const year = Number(target.slice(0, 4));
  const days = (monthStart(`${year + 1}-01`) - monthStart(`${year}-01`)) / 86400000;
  for (const key of keys) result[key].averagePerDay = result[key].estimatedYearCount! / days;
  return result;
}
