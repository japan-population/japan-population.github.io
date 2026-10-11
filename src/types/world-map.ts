import { z } from 'zod';
import { sourceSchema } from './statistics';
export const worldGdpSchema=z.object({usd:z.number().finite().nonnegative(),year:z.number().int(),worldUsd:z.number().finite().positive()});
export type WorldGdp=z.infer<typeof worldGdpSchema>;
export const worldMapSchema=z.object({
  populationDate:z.iso.date(),
  sources:z.array(sourceSchema).min(1),
  countries:z.array(z.object({
    code:z.string().regex(/^[A-Z]{3}$/),name:z.string().min(1),
    d:z.string().regex(/^[MLZ0-9.,\-]+$/),fill:z.string().regex(/^(#[0-9a-f]{6}|hsl\([\d.,%]+\))$/),
    population:z.number().finite().positive().nullable(),areaKm2:z.number().finite().positive().nullable(),
    gdp:worldGdpSchema.nullable(),
    areaYear:z.number().int().nullable(),areaReference:z.boolean(),
  })).min(170),
}).refine(data=>new Set(data.countries.map(c=>c.code)).size===data.countries.length,'Duplicate map country codes');
export type WorldMapData=z.infer<typeof worldMapSchema>;
