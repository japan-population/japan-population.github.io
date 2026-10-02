import {z} from 'zod';
export const PROJECTION_SCENARIOS=['high','medium','low'] as const;
export type ProjectionScenario=typeof PROJECTION_SCENARIOS[number];
export const PROJECTION_LABELS={high:'出生高位',medium:'出生中位',low:'出生低位'} as const;
export const PROJECTION_YEARS=Array.from({length:8},(_,i)=>2030+i*10);
const count=z.number().int().nonnegative();
const pair=z.object({total:count,japanese:count}).refine(v=>v.japanese<=v.total,'日本人人口・事象数が総数を超えています');
const age=z.tuple([count,count,count]); // total, male, female; 0–4 … 95–99, 100+
const detail=z.object({population:count,male:count,female:count,ages:z.array(age).length(21)}).superRefine((v,ctx)=>{
 if(Math.abs(v.population-v.male-v.female)>1||v.ages.some(a=>Math.abs(a[0]-a[1]-a[2])>1))ctx.addIssue({code:'custom',message:'将来推計の男女計が不一致です'});
 for(const [i,total] of [v.population,v.male,v.female].entries())if(Math.abs(v.ages.reduce((s,a)=>s+a[i],0)-total)>21)ctx.addIssue({code:'custom',message:'将来推計の年齢階級合計が不一致です'});
});
const scenario=z.object({sources:z.array(z.object({url:z.url(),table:z.string().min(1)})).length(12),points:z.array(z.object({year:z.number().int(),population:pair,birth:pair,death:pair})).length(71),details:z.record(z.string(),z.object({total:detail,japanese:detail}))}).superRefine((v,ctx)=>{
 v.points.forEach((p,i)=>{if(p.year!==2030+i)ctx.addIssue({code:'custom',message:'将来推計の年次が欠落しています'});});
 for(const year of PROJECTION_YEARS){
  const d=v.details[year],p=v.points.find(p=>p.year===year);
  if(!d||!p){ctx.addIssue({code:'custom',message:'将来推計の選択年が欠落しています'});continue;}
  for(const group of ['total','japanese'] as const)if(d[group].population!==p.population[group])ctx.addIssue({code:'custom',message:'将来推計の年次表と年齢表が不一致です'});
  for(const key of ['population','male','female'] as const)if(d.japanese[key]>d.total[key])ctx.addIssue({code:'custom',message:'国籍別の将来推計が不正です'});
  d.total.ages.forEach((a,i)=>a.forEach((value,j)=>{if(value<d.japanese.ages[i][j])ctx.addIssue({code:'custom',message:'外国人の将来年齢階級が負数です'});}));
 }
});
export const projectionsSchema=z.object({edition:z.literal('2023'),baseDate:z.literal('2020-10-01'),publishedAt:z.iso.date(),retrievedAt:z.iso.datetime({offset:true}),methodUrl:z.url(),scenarios:z.object({high:scenario,medium:scenario,low:scenario})});
export type Projections=z.infer<typeof projectionsSchema>;
export type ProjectionDetail=z.infer<typeof detail>;
