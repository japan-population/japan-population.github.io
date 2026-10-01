import type { Population, PopulationObservation } from '../../src/types/statistics';
import { addMonths, monthStart } from '../../src/lib/time';
export function populationModel(history: PopulationObservation[]): Population {
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted.at(-1);
  if (!latest) throw new Error('人口データがありません');
  const previous = sorted.find(p => p.month === addMonths(latest.month, -12));
  if (!previous) throw new Error('12か月前の人口がありません');
  return { base: latest.value, baseDate: `${latest.month}-01T00:00:00+09:00`, yearAgo: previous.value, yearAgoDate: `${previous.month}-01T00:00:00+09:00`, ratePerSecond: (latest.value - previous.value) / ((monthStart(latest.month) - monthStart(previous.month)) / 1000), source: latest.source };
}
