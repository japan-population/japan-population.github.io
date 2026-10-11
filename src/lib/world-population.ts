import { z } from 'zod';
import { addMonths, dayStart, monthKey, monthStart, secondsInMonth } from './time';
import { sourceSchema } from '../types/statistics';
export const worldPopulationSchema = z.object({
  source: sourceSchema,
  downloadUrl: z.url(),
  annualEvents: z.array(z.object({year:z.number().int().min(2024).max(2100),birth:z.number().finite().nonnegative(),death:z.number().finite().nonnegative()})).min(1).refine(rows => new Set(rows.map(r => r.year)).size === rows.length, 'Duplicate event years'),
  points: z.array(z.object({ date: z.iso.datetime({offset:true}), population: z.number().positive().finite() })).min(2),
}).refine(data => data.points.every((p,i) => i === 0 || Date.parse(p.date) > Date.parse(data.points[i-1].date)), 'Population anchors must be chronological and unique');
export type WorldPopulation = z.infer<typeof worldPopulationSchema>;
/** Linear interpolation between official annual anchors. Never extrapolate beyond the published series. */
export function estimateWorldPopulation(data: WorldPopulation, now: number) {
  const points = data.points;
  if (!Number.isFinite(now) || now < Date.parse(points[0].date) || now > Date.parse(points[points.length-1].date)) return null;
  const endIndex = points.findIndex((p,i) => i > 0 && Date.parse(p.date) >= now);
  if (endIndex < 1) return null;
  const start = points[endIndex-1], end = points[endIndex];
  const seconds = (Date.parse(end.date)-Date.parse(start.date))/1000;
  const ratePerSecond = (end.population-start.population)/seconds;
  return { population: start.population + ratePerSecond*(now-Date.parse(start.date))/1000, ratePerSecond };
}

/** World annual projections are distributed uniformly; no Japan-only seasonal profiles. */
export function estimateWorldEvents(data: WorldPopulation, now: number, kind: 'birth' | 'death') {
  if (!Number.isFinite(now)) return null;
  const month = monthKey(now), year = Number(month.slice(0,4));
  const annual = data.annualEvents.find(row => row.year === year);
  if (!annual) return null;
  const yearStart = monthStart(`${year}-01`);
  const yearSeconds = (monthStart(addMonths(`${year}-01`,12))-yearStart)/1000;
  const ratePerSecond = annual[kind]/yearSeconds;
  const estimatedMonthCount = ratePerSecond*secondsInMonth(month);
  return {
    model: {estimatedMonthCount,ratePerSecond,seasonalBase:estimatedMonthCount,trendFactor:1},
    estimate: {day:ratePerSecond*(now-dayStart(now))/1000,month:ratePerSecond*(now-monthStart(month))/1000,year:ratePerSecond*(now-yearStart)/1000,ratePerSecond,dailyTarget:ratePerSecond*86400},
    year: {officialCount:0,officialThrough:null,estimatedBeforeMonth:ratePerSecond*(monthStart(month)-yearStart)/1000,estimatedYearCount:annual[kind],averagePerDay:ratePerSecond*86400},
  };
}
