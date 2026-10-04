import inputs from '../data/tokyo-nationality-allocation.json';
import type {Source} from '../../src/types/statistics';
import {TOKYO_AREAS,tokyoAreasSchema,type TokyoArea} from '../../src/types/tokyo-areas';
import type {z} from 'zod';
type Past=z.infer<typeof tokyoAreasSchema.shape.past>;
const sexes=['male','female']as const;

// Largest remainders conserve the published sex totals after integer allocation.
export function allocateReviewedTotal(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||!weights.length||weights.some(w=>!Number.isFinite(w)||w<0)||weights.reduce((a,b)=>a+b,0)<=0)throw Error('国籍別配分の入力が不正です');
 const sum=weights.reduce((a,b)=>a+b,0),raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,r:v-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);
 for(let i=0,n=total-out.reduce((a,b)=>a+b,0);i<n;i++)out[order[i].i]++;
 return out;
}

// Manual historical backfill only. These are reference estimates, not new census
// observations. In particular, registration counts are weights, never census totals.
export function enrichTokyoNationalityAllocations(input:Past):Past{
 const past=structuredClone(input);
 const source=(year:keyof typeof inputs,scope:string):Source=>({
  publisher:'日本人口観測所（公的統計に基づく参考推計）',statistics:'東京都の国籍別男女人口の参考配分',
  table:'国勢調査・同年地域別資料による配分',sourcePeriod:`${year}-10`,publishedAt:'2026-10-04',
  retrievedAt:'2026-10-04T00:00:00+09:00',url:inputs[year].censusUrl,status:'reference',
  scope:`${scope} 配分資料：${inputs[year].distributionUrl}。実測の地域別男女数ではありません。`,
 });
 const total=(year:number,area:TokyoArea,s:typeof sexes[number])=>{
  const n=past[year]?.[area].groups.total?.[s]?.value;
  if(n===undefined)throw Error(`配分の基準人口がありません: ${year}/${area}/${s}`);return n;
 };
 const put=(year:number,area:TokyoArea,group:'japanese'|'foreign',values:number[],src:Source)=>{
  const g=past[year][area].groups[group]??{rows:[]};
  // Keep observed values and fail on accidental collisions instead of overwriting.
  for(const [i,s]of sexes.entries()){
   if(!Number.isSafeInteger(values[i])||values[i]<0||values[i]>total(year,area,s))throw Error('国籍別参考配分が総人口の範囲外です');
   if(g[s]&&!g[s]!.reference)throw Error(`公表値を参考値で上書きできません: ${year}/${area}/${group}`);
   g[s]={value:values[i],source:src,reference:true};
  }
  g.population={value:values[0]+values[1],source:src,reference:true};past[year][area].groups[group]=g;
 };
 const complement=(year:number,area:TokyoArea,foreign:number[],src:Source,unknown=[0,0])=>put(year,area,'japanese',sexes.map((s,i)=>total(year,area,s)-foreign[i]-unknown[i]),src);
 {
  const d=inputs[1940],src=source('1940','1940年国勢調査第6表（369頁）の内地人口を日本人区分とし、府の総人口との差を外国人・外地人区分とする。当時の民籍区分で現在の国籍とは異なる。府の男女別総数を固定し、同年末の在留朝鮮人・台湾人の地域別男女比で配分。その他の国籍にも同じ地域分布を仮定する粗い近似で、10月と年末の時点差がある。');
  const allocated=sexes.map((s,i)=>allocateReviewedTotal(TOKYO_AREAS.reduce((n,a)=>n+total(1940,a,s),0)-d.japaneseCensus[s],TOKYO_AREAS.map(a=>d.regionalKoreanTaiwaneseYearEnd[a][i])));
  TOKYO_AREAS.forEach((a,i)=>{const f=allocated.map(v=>v[i]);put(1940,a,'foreign',f,src);complement(1940,a,f,src);});
 }
 {
  const d=inputs[1950],src=source('1950','1950年国勢調査第6・7表。地域別国籍総数は町村表の実数。島部の外国人127人と不詳2人の男女を同年郡部の各男女比で配分し、多摩は都全体から区部・島部を差し引く。日本人は本邦・樺太千島・沖縄大島小笠原、外国人は朝鮮・中国台湾・その他。不詳を日本人にも外国人にも含めない。国籍別総数は集計値、男女の配分のみ参考推計。');
  const f=allocateReviewedTotal(d.islandsForeign,d.countyForeign),u=allocateReviewedTotal(d.islandsUnknown,d.countyUnknown);
  put(1950,'islands','foreign',f,src);complement(1950,'islands',f,src,u);
  const tf=sexes.map((_,i)=>d.tokyoForeign[i]-d.wardsForeign[i]-f[i]),tu=sexes.map((_,i)=>d.tokyoUnknown[i]-d.wardsUnknown[i]-u[i]);
  put(1950,'tama','foreign',tf,src);complement(1950,'tama',tf,src,tu);
 }
 for(const year of [1960,1970]as const){
  const d=inputs[year],areas:TokyoArea[]=year===1960?[...TOKYO_AREAS]:['tama','islands'];
  const src=source(String(year)as '1960'|'1970',`${year}年国勢調査の外国人男女別総数を固定し、同年末の地域別外国人登録数を重みとして配分。登録人口と常住人口は対象・時点が異なり、男女で同じ地域構成を仮定。${year===1970?'区部の公表外国人男女数は固定し、多摩・島部だけを配分。':''}日本人は地域の総人口から外国人参考値を控除する参考値で、国籍不詳があれば含む。`);
  const allocated=sexes.map((_,i)=>allocateReviewedTotal(d.foreignCensus[i]-(year===1970?inputs[1970].wardsForeignCensus[i]:0),areas.map(a=>(d.registeredForeignYearEnd as Partial<Record<TokyoArea,number>>)[a]!)));
  areas.forEach((a,i)=>{const f=allocated.map(v=>v[i]);put(year,a,'foreign',f,src);complement(year,a,f,src);});
  if(year===1970)complement(year,'wards',inputs[1970].wardsForeignCensus,src);
 }

 return tokyoAreasSchema.shape.past.parse(past);
}
