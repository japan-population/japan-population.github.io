import { addMonths } from '../../src/lib/time';
import type { YearTotal } from '../../src/types/statistics';
/** Published months use original counts; only unpublished months use forecasts. */
export function yearModel<K extends string>(keys: readonly K[], target: string, latest: string, actual: (month: string) => Record<K, number> | undefined, forecast: (month: string) => Record<K, number>): Record<K, YearTotal> {
  const result = Object.fromEntries(keys.map(k => [k, { officialCount: 0, estimatedBeforeMonth: 0, officialThrough: null }])) as Record<K, YearTotal>;
  for (let month = `${target.slice(0, 4)}-01`; month < target; month = addMonths(month, 1)) {
    const published = month <= latest;
    const values = published ? actual(month) : forecast(month);
    if (!values) throw new Error(`年累計の公表済み月が欠損: ${month}`);
    for (const key of keys) {
      const n = values[key];
      if (!Number.isFinite(n) || n < 0 || (published && !Number.isSafeInteger(n))) throw new Error('年累計の原値が不正です');
      if (published) { result[key].officialCount += n; result[key].officialThrough = month; }
      else result[key].estimatedBeforeMonth += n;
    }
  }
  return result;
}
