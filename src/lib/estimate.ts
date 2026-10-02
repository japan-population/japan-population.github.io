import { dayStart, monthStart, monthKey, secondsInMonth } from './time';
import type { EventModel, YearTotal, DisplayPeriod } from '../types/statistics';
export type CounterModel = { baseValue: number; baseTimestamp: number; ratePerSecond: number };
export function estimateCounter(model: CounterModel, now: number): number {
  return model.baseValue + model.ratePerSecond * (now - model.baseTimestamp) / 1000;
}
/** Legacy constant-rate API. Dashboard event cards use distribution/series instead. */
export function estimateEvent(model: EventModel, month: string, now: number, period: 'day' | 'month'): number | null {
  if (monthKey(now) !== month) return null;
  const start = period === 'day' ? dayStart(now) : monthStart(month);
  return Math.floor(model.ratePerSecond * Math.max(0, Math.min((now - start) / 1000, secondsInMonth(month))));
}

export function estimatePeriod(model: EventModel | undefined, month: string, now: number, period: DisplayPeriod, year?: YearTotal): number | null {
  if (!model || monthKey(now) !== month) return null;
  if (period !== 'year') return estimateEvent(model, month, now, period);
  if (!year) return null;
  return year.officialCount + Math.floor(year.estimatedBeforeMonth + model.ratePerSecond * (now - monthStart(month)) / 1000);
}
