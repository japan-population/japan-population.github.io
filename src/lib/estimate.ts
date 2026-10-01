import { dayStart, monthStart, monthKey, secondsInMonth } from './time';
import type { EventModel } from '../types/statistics';
export type CounterModel = { baseValue: number; baseTimestamp: number; ratePerSecond: number };
export function estimateCounter(model: CounterModel, now: number): number {
  return model.baseValue + model.ratePerSecond * (now - model.baseTimestamp) / 1000;
}
export function estimateEvent(model: EventModel, month: string, now: number, period: 'day' | 'month'): number | null {
  if (monthKey(now) !== month) return null;
  const start = period === 'day' ? dayStart(now) : monthStart(month);
  return Math.floor(model.ratePerSecond * Math.max(0, Math.min((now - start) / 1000, secondsInMonth(month))));
}
