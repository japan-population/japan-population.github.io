import {allocateRegional} from '../models/allocation';
import type {Breakdown} from '../../src/types/statistics';
import type {RegionalTimeline} from '../../src/types/regional-timeline';
import type {Source} from '../../src/types/statistics';
export const RYUKYU_1950_URL='https://www8.cao.go.jp/okinawa/okinawasen/pdf/b0401002/b0401002.pdf';
// 1952 琉球統計報告 p.46 第1表: all residents (not the domicile-only table).
// Amami: 216110 = 100524 male + 115586 female; all Ryukyu: 914937.
// The table explicitly excludes Toshima village. Do not add its 1952 survey as a 1950 count.
export function correctRegionalTerritories(timeline:RegionalTimeline,now:number){
 const r=timeline.past[1950],okinawa=r['47'],kagoshima=r['46'];
 const originalRows={okinawa:structuredClone(okinawa.groups.total!.rows),kagoshima:structuredClone(kagoshima.groups.total!.rows)};
 if(okinawa.groups.total?.population?.value!==906854||kagoshima.groups.total?.population?.value!==1804118)throw Error('1950年の地域補正元が変わりました。二重補正を中止します');
 const source:Source={...okinawa.groups.total.population.source,publisher:'琉球政府行政主席統計局',statistics:'1950年国勢調査',table:'琉球統計報告1952年6月 第1表（46頁）群島別世帯数及び男女別人口',url:RYUKYU_1950_URL,sourcePeriod:'1950-12',publishedAt:'1952-06-01',retrievedAt:new Date(now).toISOString(),scope:'公表月は1952年6月（日付は月初表記）。1950年12月1日現在。沖縄・宮古・八重山群島の全人口。奄美群島216,110人を除く。米軍・外交関係者を除く。年齢別人口は別途参考配分。'};
 const replace=(code:string,male:number,female:number,s:Source)=>{
  const g=r[code].groups.total!;g.population={value:male+female,source:s};g.male={value:male,source:s};g.female={value:female,source:s};
  // Replace totals first; reconstruct the reference age distribution below.
  g.rows=(['男女計','男','女']as const).map((sex,i)=>({group:'total',sex,age:'総数',value:[male+female,male,female][i]}));delete g.averageAge;
 };
 replace('47',328908,369919,source);
 const original=kagoshima.groups.total!;
 replace('46',original.male!.value+100524,original.female!.value+115586,{...source,publisher:'総務省統計局・琉球政府行政主席統計局',status:'reference',sourcePeriod:'1950-10',table:'鹿児島県国勢調査＋奄美群島人口',scope:'鹿児島県の1950年10月1日人口1,804,118人に、当時未包含だった奄美群島の12月1日人口216,110人を一度だけ加算。基準日が異なる参考集計。十島村の1952年人口を1950年に流用しない。1955年の公表人口は2,044,112人、1960年は1,963,104人。1950年代が人口の山であり、奄美の二重加算ではない。年齢別は参考配分。'});
 restore1950Pyramids(timeline,originalRows);
 for(const key of ['population','male','female']as const)kagoshima.groups.total![key]!.reference=true;
 if(okinawa.area&&kagoshima.area){
  const areaSource={...source,table:'国勢調査概要 付表（調査地域・面積）',url:'https://www.stat.go.jp/data/kokusei/2010/final/pdf/02-01.pdf',scope:'1950年の奄美群島の面積1,237.05km²を沖縄から鹿児島に移管。人口も同じ地域区分に組み替え。'};
  if(okinawa.area.value!==3625.27)throw Error('沖縄の1950年面積補正元が変わりました');
  okinawa.area={value:2388.22,source:areaSource};kagoshima.area={value:Math.round((kagoshima.area.value+1237.05)*100)/100,source:areaSource};
  for(const s of [okinawa,kagoshima])s.density={value:s.groups.total!.population!.value/s.area!.value,source:{...areaSource,scope:areaSource.scope+' 人口密度は補正人口÷補正面積。'},reference:true};
 }
 for(const year of [1950,1960]){
  const g=timeline.past[year]['47'].groups.total!;
  for(const key of ['population','male','female','averageAge']as const)if(g[key])g[key]!.source={...g[key]!.source,sourcePeriod:`${year}-12`};
 }
 for(const year of [1960,1970])for(const code of ['46','47']){
  const g=timeline.past[year][code].groups.total!;
  for(const key of ['population','male','female']as const)g[key]!.source={...g[key]!.source,scope:g[key]!.source.scope+' 奄美群島・吐噶喇列島は1955年以降の鹿児島県人口に収録済み。沖縄県には含まれないため、追加の移管・加算をしない。調査範囲確認：https://www.stat.go.jp/data/kokusei/2010/final/pdf/02-01.pdf'};
 }
 // Izu is already in the Tokyo census totals. Ogasawara is a different archipelago;
 // it is outside the 1950/1960 census coverage, and included again from 1970.
 for(const [year,records]of Object.entries(timeline.past)){
  const g=records['13'].groups.total!;
  for(const key of ['population','male','female']as const)if(g[key])g[key]!.source={...g[key]!.source,scope:g[key]!.source.scope+' 伊豆諸島は東京都の公表値に含まれ、別途加算していない。'+([1950,1960].includes(Number(year))?'小笠原諸島は当時の調査範囲外で、人口を補作していない。':'')};
 }
}

// Ryukyu census 1952 report p.50, Table 4: Amami domicile, NOT Amami residence.
// Use this only as a reference age profile, calibrated to the residence sex totals on p.46.
const AMAMI_DOMICILE_AGES={
 男:[15281,11673,12523,11562,8713,6387,5414,4912,4739,4080,3694,3947,3334,2525,3260],
 女:[14625,11515,12003,11954,10235,8542,7068,6283,6046,5390,4672,4787,4184,3299,5150],
};
function restore1950Pyramids(timeline:RegionalTimeline,original:{okinawa:Breakdown['rows'];kagoshima:Breakdown['rows']}){
 for(const code of ['46','47']){
  const g=timeline.past[1950][code].groups.total!;const rows:Breakdown['rows']=[];
  for(const sex of ['男','女']as const){
   const amami=AMAMI_DOMICILE_AGES[sex];
   if(amami.reduce((s,v)=>s+v,0)!==(sex==='男'?102044:115753))throw Error('奄美本籍年齢表の合計が不正です');
   const target=g[sex==='男'?'male':'female']!.value;
   const originalByAge=Array.from({length:15},(_,i)=>(code==='46'?original.kagoshima:original.okinawa).filter(r=>r.sex===sex&&/^\d/.test(r.age)&&(i===14?parseInt(r.age)>=70:parseInt(r.age)===i*5)).reduce((s,r)=>s+r.value,0));
   const amamiResidents=allocateRegional(sex==='男'?100524:115586,amami);
   const weights=code==='47'?originalByAge.map((n,i)=>n-amami[i]):originalByAge.map((n,i)=>n+amamiResidents[i]);
   if(weights.some(v=>v<0))throw Error('1950年の年齢配分が負数です');
   const counts=allocateRegional(target,weights);
   counts.forEach((value,i)=>rows.push({group:'total',sex,age:i===14?'70歳以上':`${i*5}～${i*5+4}歳`,value}));
  }
  for(let i=0;i<15;i++)rows.push({group:'total',sex:'男女計',age:rows[i].age,value:rows[i].value+rows[i+15].value});
  g.rows=[...g.rows,...rows];g.pyramidReference=true;
  g.pyramidSource={...g.population!.source,status:'reference',table:'1950年人口の参考年齢配分（琉球統計報告第1表・第4表）',url:RYUKYU_1950_URL,scope:'参考値。奄美本籍者の1950年男女・5歳階級別分布を奄美居住者の近似に使用。沖縄は全琉球本籍人口の年齢分布から奄美本籍分を除いた構成比を補正後男女総数へ配分。鹿児島は元の年齢別人口に奄美の参考配分を加える。いずれも男女総数へ最大剰余法で整合させ、上位階級を70歳以上に統一。本籍地と居住地の違いは推計誤差となる。総人口・男女総数の原値と年齢別参考値を区別。'};
  g.averageAge={value:rows.filter(r=>r.sex==='男女計').reduce((s,r)=>s+(parseInt(r.age)+2.5)*r.value,0)/g.population!.value,source:{...g.pyramidSource,scope:g.pyramidSource.scope+' 平均年齢は各階級の下限＋2.5歳の加重平均。'},reference:true};
 }
}
