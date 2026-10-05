import {z} from 'zod';
import observations from '../data/tokyo-average-age.json';
import {sourceSchema,populationGroups} from '../../src/types/statistics';
import {TOKYO_AREAS,type TokyoAreas} from '../../src/types/tokyo-areas';

const component=z.object({code:z.string().regex(/^13\d{3}$/),knownPopulation:z.number().int().positive(),mean:z.number().finite().min(0).max(120),url:z.url().optional()});
const bin=z.object({lower:z.number().int().nonnegative(),width:z.number().int().positive(),count:z.number().int().nonnegative()});
const observation=z.object({year:z.number().int(),area:z.enum(TOKYO_AREAS),group:z.enum(populationGroups),source:sourceSchema}).and(z.discriminatedUnion('method',[
 z.object({method:z.literal('published'),components:z.array(component).min(1)}),
 z.object({method:z.literal('grouped'),bins:z.array(bin).min(1)})
]));

/** Combine published averages using age-known populations, never total populations
 * or unweighted municipality means. Published rounding is retained in provenance. */
export function combinePublishedAges(parts:z.infer<typeof component>[]){
 const parsed=z.array(component).min(1).parse(parts);
 if(new Set(parsed.map(p=>p.code)).size!==parsed.length)throw Error('平均年齢の地域が重複しています');
 return parsed.reduce((sum,p)=>sum+p.mean*p.knownPopulation,0)/parsed.reduce((sum,p)=>sum+p.knownPopulation,0);
}
export function groupedAverageAge(bins:z.infer<typeof bin>[]){
 const parsed=z.array(bin).min(1).parse(bins).sort((a,b)=>a.lower-b.lower);
 if(parsed[0].lower!==0||parsed.some((b,i)=>i>0&&b.lower!==parsed[i-1].lower+parsed[i-1].width))throw Error('平均年齢の年齢階級が不連続です');
 const population=parsed.reduce((sum,b)=>sum+b.count,0);
 if(!population)throw Error('平均年齢の年齢既知人口が0です');
 return parsed.reduce((sum,b)=>sum+(b.lower+b.width/2)*b.count,0)/population;
}
export function enrichTokyoAverageAges(input:TokyoAreas['past'],raw:unknown=observations):TokyoAreas['past']{
 const past=structuredClone(input),seen=new Set<string>();
 for(const o of z.array(observation).parse(raw)){
  const key=`${o.year}/${o.area}/${o.group}`;
  if(seen.has(key))throw Error('平均年齢の観測値が重複しています');seen.add(key);
  if(o.source.sourcePeriod!==`${o.year}-10`)throw Error('平均年齢の基準年月が一致しません');
  const g=past[String(o.year)]?.[o.area].groups[o.group];
  if(!g?.population)throw Error('平均年齢に対応する人口がありません');
  const known=o.method==='published'?o.components.reduce((n,p)=>n+p.knownPopulation,0):o.bins.reduce((n,b)=>n+b.count,0);
  if(known>g.population.value)throw Error('平均年齢の母数が対象人口を超えています');
  const reference=o.method==='grouped';
  const scope=o.method==='published'
   ?'年齢不詳を除く。同年・同国籍区分の公表平均年齢を使用。複数市町村は年齢既知人口で加重平均し、旧市町村の再掲は重複集計しない。公表平均年齢の丸めを含む。'
   :`同年・同国籍区分の公表年齢別実数から階級中央値で算出した参考値。年齢不詳を除く。最上位階級は${o.bins.at(-1)!.lower+o.bins.at(-1)!.width/2}歳を仮定。`;
  g.averageAge={value:o.method==='published'?combinePublishedAges(o.components):groupedAverageAge(o.bins),reference,source:{...o.source,status:reference?'reference':o.source.status,scope:[o.source.scope,scope,...(o.method==='published'?[...new Set(o.components.flatMap(p=>p.url?[p.url]:[]))].filter(url=>url!==o.source.url):[])].join(' ')}};
 }
 return past;
}
