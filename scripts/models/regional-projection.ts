import type {Projections} from '../../src/types/projections';
import type {RegionalTimeline} from '../../src/types/regional-timeline';
import type {RegionalDetail,Source,Breakdown} from '../../src/types/statistics';
import {PREFECTURES} from '../../src/lib/prefectures';
import {makeGroup} from '../sources/regional-timeline';
// Largest remainder allocation conserves each national sex/age total exactly.
export function allocateRegional(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isFinite(w)||w<0))throw Error('地域配分の入力が不正です');
 const sum=weights.reduce((s,v)=>s+v,0);if(sum<=0)throw Error('地域配分の重みがありません');
 const raw=weights.map(w=>total*w/sum),counts=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,f:v-counts[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let n=total-counts.reduce((s,v)=>s+v,0),i=0;i<n;i++)counts[order[i].i]++;
 return counts;
}
export function extendRegionalProjections(timeline:RegionalTimeline,projections:Projections,details:Record<string,RegionalDetail>,now:number){
 const base=timeline.future[2050];if(!base)throw Error('2050年の公的地域推計がありません');
 for(const year of [2060,2070,2080,2090,2100]){
  const national=projections.scenarios.medium.details[year].total;
  const source:Source={publisher:'日本人口観測所（社人研の公表推計を基に算出）',statistics:'地域別人口の独自参考推計',table:'2050年の男女・年齢階級別地域構成比による全国中位推計の配分',sourcePeriod:`${year}-10`,publishedAt:projections.publishedAt,retrievedAt:new Date(now).toISOString(),url:projections.methodUrl,status:'projection',scope:'2060～2100年は独自参考推計。2050年の公的地域推計の各男女・年齢階級に占める都道府県の割合を固定し、全国の出生中位・死亡中位推計を配分。95歳以上は全国の95～99歳と100歳以上を合算。男女別全国総数に年齢階級を整合させ、最大剰余法で整数化。地域固有の将来の出生・死亡・移動の変化を予測するモデルではない。公表日は基礎となる全国推計の公表日。'};
  const rows:Record<string,Breakdown['rows']>=Object.fromEntries(PREFECTURES.map(p=>[p.code,[]]));
  for(const [sex,index,total]of [['男',1,national.male],['女',2,national.female]]as const){
   const nationalAges=Array.from({length:20},(_,i)=>i===19?national.ages[19][index]+national.ages[20][index]:national.ages[i][index]);
   const targets=allocateRegional(total,nationalAges);
   for(let a=0;a<20;a++){
    const age=a===19?'95歳以上':`${a*5}～${a*5+4}歳`;
    const weights=PREFECTURES.map(p=>{const row=base[p.code].groups.total?.rows.find(r=>r.sex===sex&&r.age===age);if(!row)throw Error('地域将来推計の年齢階級が欠けています');return row.value;});
    const allocated=allocateRegional(targets[a],weights);
    PREFECTURES.forEach((p,i)=>rows[p.code].push({group:'total',sex,age,value:allocated[i]}));
   }
  }
  timeline.future[year]={};
  for(const p of PREFECTURES){const r=rows[p.code];for(let a=0;a<20;a++)r.push({group:'total',sex:'男女計',age:r[a].age,value:r[a].value+r[a+20].value});
   for(const sex of ['男女計','男','女']as const)r.push({group:'total',sex,age:'総数',value:r.filter(v=>v.sex===sex).reduce((s,v)=>s+v.value,0)});
   const g=makeGroup(r,source);for(const key of ['population','male','female']as const)g[key]!.reference=true;
   timeline.future[year][p.code]={year,status:'reference',groups:{total:g}};
  }
 }
 for(const records of Object.values(timeline.future))for(const p of PREFECTURES){
  const geography=details[p.code]?.geography;if(!geography)throw Error('将来表示用の最新面積がありません');
  const r=records[p.code];r.area={value:geography.areaKm2,source:{...geography.source,scope:geography.source.scope+' 将来表示でも最新公表面積を固定して使用。'}};
  // Use the published density denominator (excludes census-inaccessible territory).
  const latestPopulation=details[p.code].rows.find(v=>v.group==='total'&&v.sex==='男女計'&&v.age==='総数')!.value;
  const effectiveArea=latestPopulation/geography.populationDensity;
  r.density={value:r.groups.total!.population!.value/effectiveArea,reference:true,source:{...r.groups.total!.population!.source,scope:`将来人口を最新人口密度の対象面積（${geography.source.sourcePeriod}の人口÷公表人口密度）で除した参考値。公表密度の丸めを含む。`}};
 }
}
