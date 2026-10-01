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
export const yearTotalSchema = z.object({ officialCount: z.number().int().nonnegative(), estimatedBeforeMonth: z.number().finite().nonnegative(), officialThrough: monthSchema.nullable(), estimatedYearCount: z.number().finite().nonnegative().optional(), averagePerDay: z.number().finite().nonnegative().optional() });
export type YearTotal = z.infer<typeof yearTotalSchema>;
export type PopulationGroup = 'total' | 'japanese' | 'foreign';
export type DisplayPeriod = 'day' | 'month' | 'year';
export const vitalYearSchema = z.object({ birth: yearTotalSchema, death: yearTotalSchema, marriage: yearTotalSchema, divorce: yearTotalSchema });
export const vitalSchema = z.object({ source: sourceSchema, months: z.record(monthSchema, eventSetSchema), yearToDate: z.record(monthSchema, vitalYearSchema).optional() });
export const populationSchema = z.object({
  base: z.number().int().positive(), baseDate: z.iso.datetime({ offset: true }),
  yearAgo: z.number().int().positive(), yearAgoDate: z.iso.datetime({ offset: true }),
  ratePerSecond: z.number().finite(), source: sourceSchema,
});
export const populationGroups = ['total', 'japanese', 'foreign'] as const;
const sexCountsSchema = z.object({ total: z.number().int().positive(), male: z.number().int().positive(), female: z.number().int().positive() }).refine(v => v.total === v.male + v.female, '男女の合計が不一致');
export const exactSexSchema = z.object({ source: sourceSchema, groups: z.object({ total: sexCountsSchema, japanese: sexCountsSchema, foreign: sexCountsSchema }) }).refine(v => (['total','male','female'] as const).every(k => v.groups.total[k] === v.groups.japanese[k] + v.groups.foreign[k]), '国籍別の合計が不一致');
export type ExactSex = z.infer<typeof exactSexSchema>;
export const breakdownSchema = z.object({ exactSex: exactSexSchema.optional(), source: sourceSchema, groups: z.object({ total: populationSchema, japanese: populationSchema, foreign: populationSchema }), rows: z.array(z.object({ group: z.enum(populationGroups), sex: z.enum(['男女計', '男', '女']), age: z.string(), value: z.number().int().nonnegative() })) }).superRefine((v, ctx) => {
  const keys = new Set(v.rows.map(r => `${r.group}/${r.sex}/${r.age}`));
  const ages = ['総数', ...Array.from({ length: 21 }, (_, i) => i === 20 ? '100歳以上' : `${i * 5}～${i * 5 + 4}歳`)];
  if (keys.size !== 198 || v.rows.length !== 198) ctx.addIssue({ code: 'custom', message: '人口内訳の欠損・重複' });
  for (const group of populationGroups) for (const sex of ['男女計', '男', '女']) for (const age of ages) if (!keys.has(`${group}/${sex}/${age}`)) ctx.addIssue({ code: 'custom', message: '人口内訳の分類が不完全です' });
});
export const MIGRATIONS = ['domesticIn', 'domesticOut', 'internationalIn', 'internationalOut'] as const;
export const migrationSetSchema = z.object({ domesticIn: eventModelSchema, domesticOut: eventModelSchema, internationalIn: eventModelSchema, internationalOut: eventModelSchema });
export const migrationYearSchema = z.object({ domesticIn: yearTotalSchema, domesticOut: yearTotalSchema, internationalIn: yearTotalSchema, internationalOut: yearTotalSchema });
export const migrationSchema = z.object({ domesticSource: sourceSchema, internationalSource: sourceSchema, months: z.record(monthSchema, migrationSetSchema), yearToDate: z.record(monthSchema, migrationYearSchema).optional() });
export const referenceSchema = z.object({ officialBase: z.number().int().positive(), officialBaseDate: z.iso.datetime({ offset: true }), source: sourceSchema, vitalSource: sourceSchema, domesticSource: sourceSchema, internationalSource: sourceSchema, months: z.record(monthSchema, z.object({ baseValue: z.number().positive(), ratePerSecond: z.number().finite() })) });
export type Breakdown = z.infer<typeof breakdownSchema>;
export type Migration = z.infer<typeof migrationSchema>;
export type MigrationKind = typeof MIGRATIONS[number];
export type MigrationCounts = Record<MigrationKind, number>;
export type MigrationObservation = { month: string; regions: Record<string, MigrationCounts> };
export type ReferencePopulation = z.infer<typeof referenceSchema>;
export const eventSeriesSchema = z.object({ source: sourceSchema, months: z.record(monthSchema, eventModelSchema), yearToDate: z.record(monthSchema, yearTotalSchema) });
export type EventSeries = z.infer<typeof eventSeriesSchema>;
export const groupedEventsSchema = z.record(z.enum(populationGroups), z.object({ birth: eventSeriesSchema.optional(), death: eventSeriesSchema.optional(), marriage: eventSeriesSchema.optional(), divorce: eventSeriesSchema.optional(), inflow: eventSeriesSchema.optional(), outflow: eventSeriesSchema.optional() }));
export type GroupedEvents = z.infer<typeof groupedEventsSchema>;
export const officialRegionSchema = z.object({ value: z.number().int().nonnegative(), source: sourceSchema, derived: z.boolean().optional() });
export const nationalSchema = z.object({ generationId: z.string(), population: populationSchema, vital: vitalSchema, eventsByGroup: groupedEventsSchema.optional(), breakdown: breakdownSchema.optional(), migration: migrationSchema.optional() });
export const prefectureSchema = z.object({ code: z.string().regex(/^(0[1-9]|[1-3]\d|4[0-7])$/), name: z.string(), officialPopulation: z.record(z.enum(populationGroups), officialRegionSchema).optional(), vital: vitalSchema, population: referenceSchema.optional(), migration: migrationSchema.optional() });
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

const mapRegionSchema = prefectureSchema.pick({code:true,name:true}).extend({officialPopulation:z.partialRecord(z.enum(populationGroups),officialRegionSchema).optional()});
export const mapRegionsSchema = z.object({generationId:z.string(),prefectures:z.record(z.string(),mapRegionSchema)}).superRefine((v,ctx)=>{
  if(Object.keys(v.prefectures).length!==47)ctx.addIssue({code:'custom',message:'47 prefectures required'});
  for(const p of PREFECTURES)if(v.prefectures[p.code]?.code!==p.code||v.prefectures[p.code]?.name!==p.name)ctx.addIssue({code:'custom',message:'Invalid region'});
});
export type SiteData = {manifest:Manifest;national:National;prefectures:z.infer<typeof mapRegionsSchema>['prefectures']};
