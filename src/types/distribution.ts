import { z } from 'zod';
export const distributionKinds = ['birth','death','inflow','outflow','marriage','divorce'] as const;
export type DistributionKind = typeof distributionKinds[number];
const metadata = {
  sourceType: z.enum(['official','derived','heuristic','uniform']),
  sourceYear: z.number().int().optional(), description: z.string().min(1),
  url: z.url().optional(), publishedAt: z.string().optional(),
};
export const weightedProfileSchema = z.object({...metadata, weights:z.array(z.number().finite().nonnegative()).min(1)}).refine(v=>v.weights.some(w=>w>0),'Weights must have a positive total');
export type WeightedProfile = z.infer<typeof weightedProfileSchema>;
const hourly = weightedProfileSchema.refine(v=>v.weights.length===24 && v.weights.every(w=>w>0),'24 positive hourly weights required');
export const eventProfileSchema = z.object({
  version:z.string(), meaning:z.string(), monthlyProfile:weightedProfileSchema.optional(),
  daily:z.object({...metadata, weekdayWeights:z.array(z.number().finite().positive()).length(7), holidayWeight:z.number().finite().positive(), specialDates:z.record(z.string(),z.number().finite().positive()), matchingMonthDayWeight:z.number().finite().positive().optional()}),
  hourlyProfiles:z.object({weekday:hourly,saturday:hourly,sunday:hourly,holiday:hourly,specialDate:hourly.optional()}),
});
export type EventProfile = z.infer<typeof eventProfileSchema>;
export const holidayCalendarSchema = z.object({sourceType:z.literal('official'),url:z.url(),fromYear:z.number().int(),throughYear:z.number().int(),dates:z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.string()),retrievedAt:z.string()});
export type HolidayCalendar = z.infer<typeof holidayCalendarSchema>;
export const distributionDataSchema = z.object({calendar:holidayCalendarSchema,birthProfile:eventProfileSchema});
export type DistributionData = z.infer<typeof distributionDataSchema>;
