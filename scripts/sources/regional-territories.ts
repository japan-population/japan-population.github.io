import type {RegionalTimeline} from '../../src/types/regional-timeline';
import type {Source} from '../../src/types/statistics';
export const RYUKYU_1950_URL='https://www8.cao.go.jp/okinawa/okinawasen/pdf/b0401002/b0401002.pdf';
// 1952 琉球統計報告 p.46 第1表: all residents (not the domicile-only table).
// Amami: 216110 = 100524 male + 115586 female; all Ryukyu: 914937.
// The table explicitly excludes Toshima village. Do not add its 1952 survey as a 1950 count.
export function correctRegionalTerritories(timeline:RegionalTimeline,now:number){
 const r=timeline.past[1950],okinawa=r['47'],kagoshima=r['46'];
 if(okinawa.groups.total?.population?.value!==906854||kagoshima.groups.total?.population?.value!==1804118)throw Error('1950年の地域補正元が変わりました。二重補正を中止します');
 const source:Source={...okinawa.groups.total.population.source,publisher:'琉球政府行政主席統計局',statistics:'1950年国勢調査',table:'琉球統計報告1952年6月 第1表（46頁）群島別世帯数及び男女別人口',url:RYUKYU_1950_URL,sourcePeriod:'1950-12',publishedAt:'1952-06-01',retrievedAt:new Date(now).toISOString(),scope:'公表月は1952年6月（日付は月初表記）。1950年12月1日現在。沖縄・宮古・八重山群島の全人口。奄美群島216,110人を除く。米軍・外交関係者を除く。元の年齢表は本籍別で居住地域と一致しないため、年齢別人口には使用しない。'};
 const replace=(code:string,male:number,female:number,s:Source)=>{
  const g=r[code].groups.total!;g.population={value:male+female,source:s};g.male={value:male,source:s};g.female={value:female,source:s};
  // Do not keep a pyramid for a different territory, or invent an age allocation.
  g.rows=(['男女計','男','女']as const).map((sex,i)=>({group:'total',sex,age:'総数',value:[male+female,male,female][i]}));delete g.averageAge;
 };
 replace('47',328908,369919,source);
 const original=kagoshima.groups.total!;
 replace('46',original.male!.value+100524,original.female!.value+115586,{...source,publisher:'総務省統計局・琉球政府行政主席統計局',sourcePeriod:'1950-10',table:'鹿児島県国勢調査＋奄美群島人口',scope:'鹿児島県の1950年10月1日人口1,804,118人に、当時未包含だった奄美群島の12月1日人口216,110人を一度だけ加算。基準日が異なる参考集計。十島村の1952年人口を1950年に流用しない。年齢別の地域対応表がないためピラミッドは表示しない。'});
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
 // Izu is already in the Tokyo census totals. Ogasawara is a different archipelago;
 // it is outside the 1950/1960 census coverage, and included again from 1970.
 for(const [year,records]of Object.entries(timeline.past)){
  const g=records['13'].groups.total!;
  for(const key of ['population','male','female']as const)if(g[key])g[key]!.source={...g[key]!.source,scope:g[key]!.source.scope+' 伊豆諸島は東京都の公表値に含まれ、別途加算していない。'+([1950,1960].includes(Number(year))?'小笠原諸島は当時の調査範囲外で、人口を補作していない。':'')};
 }
}
