import type { Migration, EventModel, YearTotal } from '../types/statistics';
export type MovementKind = 'inflow' | 'outflow';
export function movement(migration: Migration | undefined, month: string, kind: MovementKind, national: boolean): { model?: EventModel; year?: YearTotal } {
  const keys = kind === 'inflow' ? ['internationalIn', 'domesticIn'] as const : ['internationalOut', 'domesticOut'] as const;
  const selected = national ? [keys[0]] : keys;
  const models = selected.map(k => migration?.months[month]?.[k]);
  if (models.some(m => !m)) return {};
  const base = models.reduce((n, m) => n + m!.seasonalBase, 0);
  const count = models.reduce((n, m) => n + m!.estimatedMonthCount, 0);
  const model: EventModel = {
    estimatedMonthCount: count,
    ratePerSecond: models.reduce((n, m) => n + m!.ratePerSecond, 0),
    seasonalBase: base, trendFactor: base ? count / base : 0,
  };
  const years = selected.map(k => migration?.yearToDate?.[month]?.[k]);
  const year = years.every(y => y && y.officialThrough === years[0]!.officialThrough) ? {
    officialCount: years.reduce((n, y) => n + y!.officialCount, 0),
    estimatedBeforeMonth: years.reduce((n, y) => n + y!.estimatedBeforeMonth, 0), officialThrough: years[0]!.officialThrough,
    estimatedYearCount: years.every(y => y?.estimatedYearCount !== undefined) ? years.reduce((n, y) => n + y!.estimatedYearCount!, 0) : undefined,
    averagePerDay: years.every(y => y?.averagePerDay !== undefined) ? years.reduce((n, y) => n + y!.averagePerDay!, 0) : undefined,
  } : undefined;
  return { model, year };
}
