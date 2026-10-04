import {TOKYO_AREAS,type TokyoAreaSet} from '../../src/types/tokyo-areas';
import type {RegionalSnapshot} from '../../src/types/regional-timeline';
import {makeGroup} from '../sources/regional-timeline';
/** Largest remainders preserve each Tokyo-wide sex/age total exactly. */
export function allocateTokyo(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isFinite(w)||w<0)||weights.reduce((a,b)=>a+b,0)<=0)throw Error('東京都将来人口の配分値が不正です');
 const sum=weights.reduce((a,b)=>a+b,0),raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);
 const order=raw.map((n,i)=>({i,part:n-out[i]})).sort((a,b)=>b.part-a.part||a.i-b.i);
 const deficit=total-out.reduce((a,b)=>a+b,0);
 for(let i=0;i<deficit;i++)out[order[i].i]++;
 return out;
}
export function projectTokyoAreas(parent:RegionalSnapshot,base:TokyoAreaSet,latest:TokyoAreaSet,previous:TokyoAreaSet=base):TokyoAreaSet{
 const p=parent.groups.total;if(!p?.population||!p.rows.length)throw Error('東京都の将来年齢表が不足しています');
 const source={...p.population.source,publisher:'日本人口観測所',statistics:'東京都内3地域の独自参考推計',status:'reference' as const,scope:'東京全域の将来人口を2020年国勢調査の地域別・男女別・年齢階級別構成比で配分。年齢階級ごとに全域との合計を維持する固定構成比モデル。人口動態は最新公表実績の対人口比を固定した参考値。移動による増減は直前の推計年からの年平均人口増減から自然増減を差し引いた残差。地域固有の移動要因や出生率変化を予測するモデルではありません。'};
 const result=Object.fromEntries(TOKYO_AREAS.map(area=>[area,{year:parent.year,status:'reference',groups:{total:{rows:[]}},area:latest[area].area}])) as unknown as TokyoAreaSet;
 for(const r of p.rows.filter(r=>r.sex!=='男女計'&&r.age!=='総数')){
  const weights=TOKYO_AREAS.map(area=>{const g=base[area].groups.total!;const low=parseInt(r.age);return g.rows.filter(x=>x.sex===r.sex&&(x.age===r.age||r.age.endsWith('以上')&&parseInt(x.age)>=low)).reduce((n,x)=>n+x.value,0);});
  const counts=allocateTokyo(r.value,weights.every(x=>x===0)?TOKYO_AREAS.map(a=>base[a].groups.total!.population!.value):weights);
  TOKYO_AREAS.forEach((area,i)=>result[area].groups.total!.rows.push({...r,value:counts[i]}));
 }
 // The official parent may include an unknown-age residual in its sex totals.
 for(const sex of ['男','女']as const){const total=p[sex==='男'?'male':'female']?.value;if(total===undefined)throw Error('将来人口の男女総数がありません');const used=TOKYO_AREAS.map(a=>result[a].groups.total!.rows.filter(r=>r.sex===sex).reduce((s,r)=>s+r.value,0));const remainder=total-used.reduce((a,b)=>a+b,0);if(remainder<0)throw Error('将来年齢階級が総数を超えています');const extras=allocateTokyo(remainder,TOKYO_AREAS.map(a=>base[a].groups.total![sex==='男'?'male':'female']!.value));TOKYO_AREAS.forEach((area,i)=>result[area].groups.total!.rows.push({group:'total',sex,age:'総数',value:used[i]+extras[i]}));}
 for(const area of TOKYO_AREAS){const a=result[area],rows=a.groups.total!.rows;for(const age of [...new Set(rows.map(r=>r.age))])rows.push({group:'total',sex:'男女計',age,value:rows.filter(r=>r.age===age).reduce((n,r)=>n+r.value,0)});const g=makeGroup(rows,source);a.groups.total=g;g.pyramidSource=source;g.pyramidReference=true;g.population.reference=true;g.male!.reference=true;g.female!.reference=true;const actual=latest[area].groups.total!;const ratio=g.population.value/actual.population!.value;
  if(actual.events){g.events={};for(const [k,v]of Object.entries(actual.events))g.events[k as keyof typeof g.events]={value:Math.round(v.value*ratio),reference:true,source:{...source,table:`${v.source.table}を人口比で配分`,scope:source.scope+` 基準実績：${v.source.sourcePeriod}。${v.source.scope}`,sourcePeriod:`${parent.year}-12`}};}
  if(g.events?.birth&&g.events.death)g.naturalChange={value:g.events.birth.value-g.events.death.value,reference:true,source};
  const before=previous[area],years=parent.year-before.year;if(years<=0)throw Error('将来人口の基準年が不正です');
  if(g.naturalChange&&before.groups.total?.population){const annualChange=Math.round((g.population.value-before.groups.total.population.value)/years);const net=annualChange-g.naturalChange.value;g.migrationChange={value:net,reference:true,source:{...source,scope:source.scope+` 人口変化の期間：${before.year}–${parent.year}年。`}};
   if(g.events?.inflow&&g.events.outflow){const volume=Math.max(Math.abs(net),g.events.inflow.value+g.events.outflow.value);g.events.inflow.value=Math.round((volume+net)/2);g.events.outflow.value=g.events.inflow.value-net;}
  }
  if(a.area)a.density={value:g.population.value/a.area.value,reference:true,source};
 }
 if(TOKYO_AREAS.reduce((s,a)=>s+result[a].groups.total!.population!.value,0)!==p.population.value)throw Error('東京都の将来人口合計が不一致です');
 return result;
}

export function projectTokyoTimeline(parents:Record<string,Record<string,RegionalSnapshot>>,base:TokyoAreaSet,latest:TokyoAreaSet){
 const future:Record<string,TokyoAreaSet>={};let previous=base;
 for(const year of Object.keys(parents).map(Number).sort((a,b)=>a-b)){future[year]=projectTokyoAreas(parents[year]['13'],base,latest,previous);previous=future[year];}
 return future;
}
