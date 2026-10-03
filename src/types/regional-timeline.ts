import {z} from 'zod';
import {sourceSchema,breakdownSchema,populationGroups} from './statistics';
export const REGIONAL_PAST_YEARS=Array.from({length:11},(_,i)=>1920+i*10);
export const REGIONAL_FUTURE_YEARS=Array.from({length:8},(_,i)=>2030+i*10);
const metric=z.object({value:z.number().finite(),source:sourceSchema,reference:z.boolean().optional(),migrationCoverage:z.literal('domestic-japanese').optional(),estimateKind:z.literal('residual').optional(),calculation:z.object({method:z.enum(['single-year','multi-year']).optional(),startDate:z.iso.date().optional(),endDate:z.iso.date().optional(),startYear:z.number().int(),endYear:z.number().int(),populationStart:z.number().positive(),populationEnd:z.number().positive(),annualPopulationChange:z.number().finite(),naturalChange:z.number().finite(),naturalBasis:z.enum(['regional-japanese','national-rate','official-count','official-rate'])}).optional()});
export const regionalSnapshotSchema=z.object({
  year:z.number().int(),status:z.enum(['final','projection','reference']),
  groups:z.partialRecord(z.enum(populationGroups),z.object({
    population:metric.optional(),male:metric.optional(),female:metric.optional(),
    rows:breakdownSchema.shape.rows,pyramidSource:sourceSchema.optional(),pyramidReference:z.boolean().optional(),averageAge:metric.optional(),
    events:z.object({birth:metric.optional(),death:metric.optional(),inflow:metric.optional(),outflow:metric.optional(),marriage:metric.optional(),divorce:metric.optional()}).optional(),
    naturalChange:metric.optional(),migrationChange:metric.optional(),fertilityRate:metric.optional(),
  })),
  area:metric.optional(),density:metric.optional(),
});
export const regionalTimelineSchema=z.object({past:z.record(z.string(),z.record(z.string(),regionalSnapshotSchema)),future:z.record(z.string(),z.record(z.string(),regionalSnapshotSchema))});
export type RegionalSnapshot=z.infer<typeof regionalSnapshotSchema>;
export type RegionalTimeline=z.infer<typeof regionalTimelineSchema>;
export type RegionalMetric=z.infer<typeof metric>;

export const regionalYearSchema=z.object({generationId:z.string(),period:z.enum(['past','future']),year:z.number().int(),regions:z.record(z.string(),regionalSnapshotSchema)}).superRefine((v,ctx)=>{if(Object.keys(v.regions).length!==47||Object.values(v.regions).some(s=>s.year!==v.year))ctx.addIssue({code:'custom',message:'地域時系列の年・件数が不一致です'});});

export const regionalIndexSchema=z.object({generationId:z.string(),past:z.array(z.number().int()),future:z.array(z.number().int()),availablePast:z.record(z.enum(populationGroups),z.array(z.number().int()))});
