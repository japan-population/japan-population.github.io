import { distributionDataSchema } from './distribution';
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
export const monthlyTargetSchema = z.object({count:z.number().finite().nonnegative(),sourceType:z.enum(['official','derived'])});
export const yearTotalSchema = z.object({ monthlyTargets:z.record(monthSchema,monthlyTargetSchema).optional(), officialCount: z.number().int().nonnegative(), estimatedBeforeMonth: z.number().finite().nonnegative(), officialThrough: monthSchema.nullable(), estimatedYearCount: z.number().finite().nonnegative().optional(), averagePerDay: z.number().finite().nonnegative().optional() });
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
export const nationalitiesSchema = z.object({
  source:sourceSchema, total:z.number().int().positive(),
  populationTotal:z.number().int().positive().optional(), // Same census date and population universe.
  items:z.array(z.object({code:z.string(),name:z.string().min(1),value:z.number().int().nonnegative()})).min(1),
}).superRefine((v,ctx)=>{
  if(v.populationTotal!==undefined&&v.total>v.populationTotal)ctx.addIssue({code:'custom',message:'外国人人口が総人口を超えています'});
  if(new Set(v.items.map(i=>i.code)).size!==v.items.length||v.items.reduce((n,i)=>n+i.value,0)!==v.total)ctx.addIssue({code:'custom',message:'国籍内訳の合計またはコードが不正です'});
});
export type Nationalities = z.infer<typeof nationalitiesSchema>;
export const CENSUS_YEARS = Array.from({length:11},(_,i)=>1920+i*10);
const ageExclusionSchema=z.object({fromAge:z.literal(85),scopeLabel:z.literal('沖縄を除く'),omitted:z.object({total:z.number().int().nonnegative(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative()})}).refine(v=>v.omitted.total===v.omitted.male+v.omitted.female,'除外人口の男女計が不一致です');
const censusGroupSchema=z.object({
  population:z.number().int().positive(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative(),
  source:sourceSchema,ageSource:sourceSchema.optional(),ageSupportingSources:z.array(sourceSchema).optional(),ageExclusion:ageExclusionSchema.optional(),rows:breakdownSchema.shape.rows,
  derivation:z.object({method:z.literal('total-minus-foreign'),sources:z.tuple([sourceSchema,sourceSchema])}).optional(),
  coverage:z.enum(['full','summary']).optional(),referenceNote:z.string().min(1).optional(),precision:z.union([z.literal(1),z.literal(1000)]).optional(),
}).superRefine((v,ctx)=>{
  if(v.precision===1000&&(v.coverage!=='summary'||!v.referenceNote||[v.population,v.male,v.female].some(n=>n%1000!==0)))ctx.addIssue({code:'custom',message:'公表概数の精度・注記が不正です'});
  if(Math.abs(v.male+v.female-v.population)>(v.precision===1000?1000:0))ctx.addIssue({code:'custom',message:'国勢調査の男女計が不一致です'});
  if(v.coverage==='summary'){if(v.rows.length)ctx.addIssue({code:'custom',message:'総数のみの資料に年齢内訳があります'});return;}
  for(const sex of ['男女計','男','女']){
    const rows=v.rows.filter(r=>r.sex===sex&&r.age!=='総数');
    if(rows.length<18||new Set(rows.map(r=>r.age)).size!==rows.length)ctx.addIssue({code:'custom',message:'国勢調査の年齢階級が欠損・重複しています'});
    const limit=sex==='男'?v.male:sex==='女'?v.female:v.population;
    if(v.rows.find(r=>r.sex===sex&&r.age==='総数')?.value!==limit)ctx.addIssue({code:'custom',message:'国勢調査の総数と内訳が不一致です'});
    if(rows.reduce((n,r)=>n+r.value,0)>limit)ctx.addIssue({code:'custom',message:'国勢調査の年齢別合計が人口を超えています'});
  }
  const ages=v.rows.filter(r=>r.sex==='男女計'&&r.age!=='総数').map(r=>r.age);
  for(const age of ages){
    const total=v.rows.find(r=>r.age===age&&r.sex==='男女計')!.value;
    const male=v.rows.find(r=>r.age===age&&r.sex==='男')?.value,female=v.rows.find(r=>r.age===age&&r.sex==='女')?.value;
    if(male===undefined||female===undefined||male+female!==total)ctx.addIssue({code:'custom',message:'年齢階級の男女計が不一致です'});
  }
});
export const annualOfficialSchema=z.object({year:z.number().int(),source:sourceSchema,
  counts:z.object({birth:z.number().int().nonnegative(),death:z.number().int().nonnegative(),marriage:z.number().int().nonnegative(),divorce:z.number().int().nonnegative()})});
export type AnnualOfficial=z.infer<typeof annualOfficialSchema>;
export const censusSnapshotSchema=z.object({year:z.number().int(),date:z.iso.date(),nationalities:nationalitiesSchema.optional(),groups:z.partialRecord(z.enum(populationGroups),censusGroupSchema)});
export type CensusSnapshot=z.infer<typeof censusSnapshotSchema>;
export const officialArchiveSchema=z.object({censuses:z.array(censusSnapshotSchema),annual:z.array(annualOfficialSchema)}).superRefine((v,ctx)=>{
  if(v.censuses.length!==11||CENSUS_YEARS.some(y=>v.censuses.filter(c=>c.year===y&&c.date===`${y}-10-01`&&c.groups.total).length!==1))ctx.addIssue({code:'custom',message:'国勢調査11時点が揃っていません'});
  if(new Set(v.annual.map(a=>a.year)).size!==v.annual.length||CENSUS_YEARS.some(y=>!v.annual.some(a=>a.year===y)))ctx.addIssue({code:'custom',message:'年間人口動態に欠損・重複があります'});
  for(const c of v.censuses)for(const [g,p]of Object.entries(c.groups))if(p.source.sourcePeriod!==`${c.year}-10`||p.rows.some(r=>r.group!==g))ctx.addIssue({code:'custom',message:'国勢調査の年・国籍が不一致です'});
  for(const c of v.censuses)if(c.nationalities&&(c.nationalities.source.sourcePeriod!==`${c.year}-10`||c.nationalities.total!==c.groups.foreign?.population||c.nationalities.populationTotal!==c.groups.total?.population))ctx.addIssue({code:'custom',message:'過去国籍内訳の基準年・人口が不一致です'});
  for(const c of v.censuses){
    const p=c.groups.japanese,t=c.groups.total,f=c.groups.foreign;
    if(p?.derivation&&(!t||!f||c.year>1990||p.precision!==1||!p.referenceNote||p.derivation.sources.some(s=>s.sourcePeriod!==`${c.year}-10`)||(['population','male','female'] as const).some(k=>p[k]!==t[k]-f[k])))ctx.addIssue({code:'custom',message:'日本人参考推計の算式・出典が不一致です'});
  }
  for(const a of v.annual)if(a.source.sourcePeriod!==`${a.year}-12`)ctx.addIssue({code:'custom',message:'年間人口動態の基準年が不一致です'});
});
export type OfficialArchive=z.infer<typeof officialArchiveSchema>;
export const populationTrendSchema=z.object({
  sources:z.array(sourceSchema).min(1),
  points:z.array(z.object({date:z.iso.date(),total:z.number().int().positive(),japanese:z.number().int().nonnegative().optional(),foreign:z.number().int().nonnegative().optional(),precision:z.union([z.literal(1),z.literal(1000)]),sourceIndex:z.number().int().nonnegative()})).min(81),
}).superRefine((v,ctx)=>{
  v.points.forEach((p,i)=>{
    if(p.sourceIndex>=v.sources.length||p.total%p.precision!==0)ctx.addIssue({code:'custom',message:'年次人口の出典・精度が不正です'});
    if((p.japanese===undefined)!==(p.foreign===undefined)||p.japanese!==undefined&&p.japanese+p.foreign! !==p.total)ctx.addIssue({code:'custom',message:'年次人口の国籍別合計が不一致です'});
    if(Number(p.date.slice(0,4))!==1920+i)ctx.addIssue({code:'custom',message:'年次人口に欠損・重複があります'});
  });
});
export type PopulationTrend=z.infer<typeof populationTrendSchema>;
export const nationalSchema = z.object({ populationTrend:populationTrendSchema.optional(), archive:officialArchiveSchema.optional(), generationId: z.string(), distribution: distributionDataSchema.optional(), nationalities:nationalitiesSchema.optional(), population: populationSchema, vital: vitalSchema, eventsByGroup: groupedEventsSchema.optional(), breakdown: breakdownSchema.optional(), migration: migrationSchema.optional() });
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
