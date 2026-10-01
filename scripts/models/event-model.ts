import { EVENTS, type EventSet, type VitalObservation } from '../../src/types/statistics';
import { addMonths, secondsInMonth } from '../../src/lib/time';
export function eventModel(history: VitalObservation[], region: string, target: string): EventSet {
  const rows = new Map(history.map(row => [row.month, row]));
  if (rows.size !== history.length) throw new Error('人口動態の月が重複しています');
  const latest = [...rows.keys()].sort().at(-1);
  if (!latest || latest >= target) throw new Error('予測対象月は最新観測月より後にしてください');
  const get = (month: string, kind: typeof EVENTS[number]) => {
    const n = rows.get(month)?.regions[region]?.[kind];
    if (n === undefined || !Number.isFinite(n) || n < 0) throw new Error(`人口動態の欠損: ${month} / ${region} / ${kind}`);
    return n;
  };
  return Object.fromEntries(EVENTS.map(kind => {
    const recent = Array.from({ length: 12 }, (_, i) => get(addMonths(latest, -i), kind)).reduce((a, b) => a + b, 0);
    const prior = Array.from({ length: 12 }, (_, i) => get(addMonths(latest, -12 - i), kind)).reduce((a, b) => a + b, 0);
    if (prior === 0) throw new Error(`トレンド分母が0: ${region} / ${kind}`);
    const seasonalBase = [1, 2, 3].map(i => get(addMonths(target, -12 * i), kind)).reduce((a, b) => a + b, 0) / 3;
    const trendFactor = recent / prior;
    const estimatedMonthCount = seasonalBase * trendFactor;
    return [kind, { seasonalBase, trendFactor, estimatedMonthCount, ratePerSecond: estimatedMonthCount / secondsInMonth(target) }];
  })) as EventSet;
}
