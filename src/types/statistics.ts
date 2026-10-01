import { z } from 'zod';
import { PREFECTURES } from '../lib/prefectures';
export const EVENTS = ['birth', 'death', 'marriage', 'divorce'] as const;
export type EventKind = typeof EVENTS[number];
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const sourceSchema = z.object({
  publisher: z.string().min(1), statistics: z.string().min(1), table: z.string().min(1),
  sourcePeriod: monthSchema, publishedAt: z.iso.date(), retrievedAt: z.iso.datetime({ offset: true }),
  url: z.url(), status: z.enum(['final', 'provisional', 'fixture']), scope: z.string().min(1),
});
export const eventModelSchema = z.object({
  estimatedMonthCount: z.number().finite().nonnegative(), ratePerSecond: z.number().finite().nonnegative(),
  seasonalBase: z.number().finite().nonnegative(), trendFactor: z.number().finite().nonnegative(),
});
export const eventSetSchema = z.object({ birth: eventModelSchema, death: eventModelSchema, marriage: eventModelSchema, divorce: eventModelSchema });
export const vitalSchema = z.object({ source: sourceSchema, months: z.record(monthSchema, eventSetSchema) });
export const populationSchema = z.object({
  base: z.number().int().positive(), baseDate: z.iso.datetime({ offset: true }),
  yearAgo: z.number().int().positive(), yearAgoDate: z.iso.datetime({ offset: true }),
  ratePerSecond: z.number().finite(), source: sourceSchema,
});
export const nationalSchema = z.object({ generationId: z.string(), population: populationSchema, vital: vitalSchema });
export const prefectureSchema = z.object({ code: z.string().regex(/^(0[1-9]|[1-3]\d|4[0-7])$/), name: z.string(), vital: vitalSchema });
export const prefecturesSchema = z.object({ generationId: z.string(), prefectures: z.record(z.string(), prefectureSchema) }).superRefine((v, ctx) => {
  if (Object.keys(v.prefectures).length !== 47) ctx.addIssue({ code: 'custom', message: 'Exactly 47 prefectures required' });
  for (const p of PREFECTURES) if (v.prefectures[p.code]?.code !== p.code || v.prefectures[p.code]?.name !== p.name) ctx.addIssue({ code: 'custom', message: `Invalid prefecture ${p.code}` });
});
export const manifestSchema = z.object({ schemaVersion: z.literal(1), generationId: z.string(), generatedAt: z.iso.datetime({ offset: true }), mode: z.enum(['fixture', 'official']), population: z.object({ latestFinalMonth: monthSchema }), vital: z.object({ latestMonth: monthSchema }), forecastMonths: z.array(monthSchema).min(1), historyStart: monthSchema });
export type Source = z.infer<typeof sourceSchema>;
export type Population = z.infer<typeof populationSchema>;
export type EventModel = z.infer<typeof eventModelSchema>;
export type EventSet = z.infer<typeof eventSetSchema>;
export type Vital = z.infer<typeof vitalSchema>;
export type National = z.infer<typeof nationalSchema>;
export type Prefecture = z.infer<typeof prefectureSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type DashboardData = { manifest: Manifest; national: National; prefectures: Record<string, Prefecture> };
export type MonthlyEvents = Record<EventKind, number>;
export type VitalObservation = { month: string; regions: Record<string, MonthlyEvents>; source: Source };
export type PopulationObservation = { month: string; value: number; source: Source };
