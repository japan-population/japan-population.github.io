import {csv} from './tokyo-areas';
import {makeGroup} from './regional-timeline';
import {TOKYO_AREAS,type TokyoAreaSet} from '../../src/types/tokyo-areas';
import type {Breakdown,Source} from '../../src/types/statistics';

const number=(s:string)=>{if(s==='-')return 0;const n=Number(s.replaceAll(',',''));if(!s.trim()||!Number.isFinite(n)||n<0)throw Error('東京都過去統計の値が不正です');return n;};
export function census2000(bytes:Uint8Array,areas:TokyoAreaSet,source:Source){
 const data=csv(bytes).filter(r=>r[0]==='全域');
 const codes={wards:['13100'],tama:[...new Set(data.map(r=>r[3]))].filter(c=>/^132\d\d$/.test(c)||['13303','13305','13307','13308'].includes(c)),islands:['13361','13362','13363','13364','13381','13382','13401','13402','13421']};
 for(const area of TOKYO_AREAS)for(const group of ['total','japanese']as const){
  const rows:Breakdown['rows']=[];
  const ages=['総数',...Array.from({length:20},(_,i)=>`${i*5}～${i*5+4}歳`),'100歳以上','不詳'];
  for(const age of ages)for(const [i,sex]of (['男女計','男','女']as const).entries()){
   const selected=codes[area].map(c=>data.filter(r=>r[3]===c&&r[1]===(group==='total'?'総数':'日本人')&&r[2]===age));
   if(selected.some(r=>r.length!==1))throw Error('東京都2000年の地域・年齢が一意ではありません');
   rows.push({group,sex,age:age==='不詳'?'年齢不詳':age,value:selected.reduce((n,r)=>n+number(r[0][5+i]),0)});
  }
  const g=makeGroup(rows,source);if(group==='total'&&g.population.value!==areas[area].groups.total?.population?.value)throw Error('東京都2000年の地域境界が不一致です');
  areas[area].groups[group]={...areas[area].groups[group],...g};
 }
}
export function census1980(data:Record<'wards'|'city'|'county'|'islands',number[][]>,areas:TokyoAreaSet,source:Source){
 for(const area of TOKYO_AREAS){
  const cells=area==='tama'?data.city.map((v,i)=>v.map((n,j)=>n+data.county[i][j])):data[area];
  if(cells.length!==22)throw Error('1980年の年齢階級が不足しています');
  const rows:Breakdown['rows']=[];
  for(const [i,pair]of cells.entries())for(const [j,sex]of (['男女計','男','女']as const).entries())rows.push({group:'total',sex,age:i===21?'年齢不詳':i===20?'100歳以上':`${i*5}～${i*5+4}歳`,value:j===0?pair[0]+pair[1]:pair[j-1]});
  for(const sex of ['男女計','男','女']as const)rows.push({group:'total',sex,age:'総数',value:rows.filter(r=>r.sex===sex).reduce((n,r)=>n+r.value,0)});
  const g=makeGroup(rows,source);if(g.population.value!==areas[area].groups.total?.population?.value)throw Error('1980年の年齢合計が総人口と不一致です');
  areas[area].groups.total={...areas[area].groups.total,...g};
 }
}

// The metropolitan total includes all three areas. Subtract observed wards and
// islands by sex and age, rather than allocating Tokyo's age distribution.
export function censusResidual(data:Record<'total'|'wards'|'islands',number[][]>,ages:string[],areas:TokyoAreaSet,source:Source){
 for(const a of TOKYO_AREAS){
  const cells=a==='tama'?data.total.map((v,i)=>v.map((n,j)=>n-data.wards[i][j]-data.islands[i][j])):data[a];
  if(cells.length!==ages.length||cells.some(v=>v.length!==2||v.some(n=>!Number.isSafeInteger(n)||n<0)))throw Error('東京都の年齢別原表が不正です');
  const rows:Breakdown['rows']=cells.flatMap((v,i)=>(['男女計','男','女']as const).map((sex,j)=>({group:'total',sex,age:ages[i],value:j?v[j-1]:v[0]+v[1]})));
  for(const sex of ['男女計','男','女']as const)rows.push({group:'total',sex,age:'総数',value:rows.filter(r=>r.sex===sex).reduce((n,r)=>n+r.value,0)});
  const g=makeGroup(rows,source);
  if(g.population.value!==areas[a].groups.total?.population?.value)throw Error('東京都の年齢合計が公表総人口と一致しません');
  areas[a].groups.total={...areas[a].groups.total,...g};
 }
}
