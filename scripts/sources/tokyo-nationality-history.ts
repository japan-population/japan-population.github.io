import {z} from 'zod';
import observations from '../data/tokyo-nationality-observations.json';
import {sourceSchema} from '../../src/types/statistics';
import {TOKYO_AREAS,tokyoAreasSchema} from '../../src/types/tokyo-areas';

const observationSchema=z.object({
 year:z.number().int(),area:z.enum(TOKYO_AREAS),group:z.enum(['japanese','foreign']),
 population:z.number().int().nonnegative(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative(),
 source:sourceSchema,reference:z.boolean().default(false),
}).refine(v=>v.population===v.male+v.female,'国籍別男女計が不一致です');
type Past=z.infer<typeof tokyoAreasSchema.shape.past>;

// Reviewed census observations only. Missing nationality is never inferred from
// total population: total minus foreigners can include nationality unknown.
export function enrichTokyoNationalityHistory(input:Past, reviewed:unknown=observations):Past{
 const past=structuredClone(input),seen=new Set<string>();
 for(const v of z.array(observationSchema).parse(reviewed)){
  const key=`${v.year}/${v.area}/${v.group}`;
  if(seen.has(key))throw Error(`国籍別人口の重複: ${key}`);
  seen.add(key);
  if(v.source.sourcePeriod!==`${v.year}-10`)throw Error(`国籍別人口の基準年不一致: ${key}`);
  const snapshot=past[v.year]?.[v.area];
  if(!snapshot?.groups.total?.population)throw Error(`東京都の基準人口がありません: ${key}`);
  for(const metric of ['population','male','female']as const){
   const total=snapshot.groups.total[metric]?.value;
   if(total!==undefined&&v[metric]>total)throw Error(`国籍別人口が総人口を超えています: ${key}`);
  }
  const group=snapshot.groups[v.group]??{rows:[]};
  for(const metric of ['population','male','female']as const)group[metric]={value:v[metric],source:v.source,reference:v.reference};
  snapshot.groups[v.group]=group;
 }
 for(const set of Object.values(past))for(const snapshot of Object.values(set)){
  for(const metric of ['population','male','female']as const){
   const total=snapshot.groups.total?.[metric]?.value,japanese=snapshot.groups.japanese?.[metric]?.value,foreign=snapshot.groups.foreign?.[metric]?.value;
   if(total!==undefined&&japanese!==undefined&&foreign!==undefined&&japanese+foreign>total)throw Error('国籍別人口の合計が総人口を超えています');
  }
 }
 return tokyoAreasSchema.shape.past.parse(past);
}
