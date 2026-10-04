import {parse} from 'csv-parse/sync';
import {load} from 'cheerio';
import {download} from './http';
import {makeGroup} from './regional-timeline';
import {TOKYO_AREAS,type TokyoAreaSet} from '../../src/types/tokyo-areas';
import {populationGroups,type Source} from '../../src/types/statistics';
import {readTamaFertility,addTamaFertility} from './tokyo-fertility';
export const TOKYO_STAT='https://www.toukei.metro.tokyo.lg.jp';
export function csv(bytes:Uint8Array):string[][]{
 const utf=new TextDecoder().decode(bytes);return parse(utf.includes('\ufffd')?new TextDecoder('shift_jis').decode(bytes):utf,{bom:true,relax_column_count:true,skip_empty_lines:true}) as string[][];
}
export function tokyoSource(url:string,period:string,table:string,now:number,scope:string):Source{return {publisher:'東京都',statistics:'東京都地域統計',table,sourcePeriod:period,publishedAt:String(new Date(now).getUTCFullYear()),retrievedAt:new Date(now).toISOString(),url,status:'final',scope};}
export const AREA_CODES={wards:['13100'],tama:['13200','13300'],islands:['13350']};
export function emptyAreas(year:number):TokyoAreaSet{return Object.fromEntries(TOKYO_AREAS.map(a=>[a,{year,status:'final',groups:{}}])) as TokyoAreaSet;}
function count(text:string){if(text==='-')return 0;const v=Number(text.replaceAll(',',''));if(!text.trim()||!Number.isFinite(v))throw Error('東京都統計に欠損・不正な値があります');return v;}
export function registryAreas(bytes:Uint8Array,source:Source):TokyoAreaSet{
 const rows=csv(bytes),result=emptyAreas(Number(source.sourcePeriod.slice(0,4)));
 if(!rows[0].join().includes('日本人／計'))throw Error('東京都年齢表の形式が変更されました');
 for(const area of TOKYO_AREAS)for(const [gi,group]of populationGroups.entries()){
  const cells=new Map<string,number>();const seen=new Set<string>();
  for(const code of AREA_CODES[area]){const local=rows.filter(r=>r[1]===code&&['0','1'].includes(r[3]));if(local.length<20)throw Error('東京都地域年齢表が不足しています');
   for(const r of local){if(seen.has(`${code}/${r[4]}`))throw Error('東京都地域年齢表が重複しています');seen.add(`${code}/${r[4]}`);const age=r[4]==='総数'?'総数':r[4].replace(/^(\d+)～(\d+)$/,'$1～$2歳').replace(/^(\d+)以上$/,'$1歳以上').replace('不詳者','年齢不詳');
    for(const [si,sex]of (['男女計','男','女']as const).entries()){const key=`${sex}/${age}`;cells.set(key,(cells.get(key)??0)+count(r[5+gi*3+si]));}}
  }
  result[area].groups[group]=makeGroup([...cells].map(([key,value])=>{const [sex,age]=key.split('/');return {group,sex:sex as '男女計'|'男'|'女',age,value};}),source);
 }
 return result;
}
export function addTokyoMovement(areas:TokyoAreaSet,input:{inflow:Uint8Array;outflow:Uint8Array;international:Uint8Array;matrix:Uint8Array},source:Source){
 const tables={inflow:csv(input.inflow),outflow:csv(input.outflow)},international=csv(input.international),matrix=csv(input.matrix);
 if([tables.inflow,tables.outflow].some(t=>t[0][3]!=='地域コード'||!t[0][5]?.startsWith('総数'))||international[0][3]!=='地域コード'||!international[0][5]?.startsWith('国外から')||!international[0][8]?.startsWith('国外への')||matrix[0][1]!=='地域コード'||!matrix[0][6]?.startsWith('都の区部から'))throw Error('東京都移動表の形式が変更されました');
 for(const area of TOKYO_AREAS){
  const sum=(rows:string[][],codeCol:number,valueCol:number,filter:(r:string[])=>boolean)=>AREA_CODES[area].reduce((acc,code)=>{const matches=rows.filter(r=>r[codeCol]===code&&filter(r));if(matches.length!==1)throw Error('東京都移動の地域・国籍区分が一意ではありません');return acc+count(matches[0][valueCol]);},0);
  const domestic=(kind:'inflow'|'outflow',jp:boolean)=>sum(tables[kind],3,5,r=>r[1]===(jp?'日本人のみ':'外国人含む'));
  const overseas=(kind:'inflow'|'outflow',jp:boolean)=>sum(international,3,kind==='inflow'?5:8,r=>r[2]===(jp?'日本人のみ':'外国人含む'));
  for(const group of populationGroups){const g=areas[area].groups[group];if(!g)continue;
   const values=(jp:boolean)=>({inflow:domestic('inflow',jp)+overseas('inflow',jp),outflow:domestic('outflow',jp)+overseas('outflow',jp)});
   const total=values(false),japanese=values(true),v=group==='total'?total:group==='japanese'?japanese:{inflow:total.inflow-japanese.inflow,outflow:total.outflow-japanese.outflow};
   // Internal moves cancel in the net. Never include registry deletions as emigration.
   g.migrationChange={value:v.inflow-v.outflow,source};
   // The published matrix separates wards from the rest, but not Tama from islands.
   // Publish gross flows only when same-area municipal moves can be removed exactly.
   if(area==='wards'&&group==='total'){
    const internal=sum(matrix,1,6,()=>true);g.events??={};
    for(const kind of ['inflow','outflow']as const){const value=v[kind]-internal;if(value<0)throw Error('東京都の内部移動控除が不正です');g.events[kind]={value,source};}
   }
  }
 }
}
export function addTokyoHealth(areas:TokyoAreaSet,tables:Record<'birth'|'death'|'marriage'|'fertility',Uint8Array>,year:number,source:Source){
 const era=year>=2019?`令和${year===2019?'元':year-2018}年`:`平成${year-1988}年`;
 for(const area of TOKYO_AREAS)for(const kind of ['birth','death','marriage','divorce','fertility']as const){
  const rows=csv(tables[kind==='divorce'?'marriage':kind]);const label={birth:'出生数',death:'死亡数',marriage:'婚姻件数',divorce:'離婚件数',fertility:''}[kind];const col=rows[0].findIndex(h=>h===era+(label?`の${label}`:''));if(col<0)continue;
  const names=area==='wards'?['区部']:area==='tama'?['市部','郡部']:['島部'];
  // A total fertility rate cannot be obtained by adding the city and county rates.
  if(kind==='fertility'&&names.length!==1)continue;
  const selected=names.map(name=>rows.find(r=>r[0].replace(/\s/g,'')===name));if(selected.some(r=>!r||!r[col]?.trim()||!/^\d+(\.\d+)?$/.test(r[col])))continue;
  const value=selected.reduce((n,r)=>n+count(r![col]),0);
  for(const group of ['total','japanese']as const){const g=areas[area].groups[group]??={rows:[]};const metric={value,source:{...source,sourcePeriod:`${year}-12`}};if(kind==='fertility')g.fertilityRate=metric;else{g.events??={};g.events[kind]=metric;}}
 }
 for(const a of Object.values(areas))for(const g of Object.values(a.groups))if(g.events?.birth&&g.events.death)g.naturalChange={value:g.events.birth.value-g.events.death.value,source:g.events.birth.source};
}
export function addTokyoRegisteredVital(areas:TokyoAreaSet,tables:{birth:Uint8Array;death:Uint8Array},source:Source){
 for(const area of TOKYO_AREAS)for(const [gi,group]of populationGroups.entries()){
  const g=areas[area].groups[group];if(!g)continue;g.events??={};
  for(const kind of ['birth','death']as const){const rows=csv(tables[kind]);const value=AREA_CODES[area].reduce((n,code)=>{const matches=rows.filter(r=>r[0]===['総数','日本人','外国人'][gi]&&r[2]===code);if(!matches.length||new Set(matches.map(r=>r.at(-1))).size!==1)throw Error('東京都の出生・死亡集計が不一致です');return n+count(matches[0].at(-1)!);},0);g.events[kind]={value,source};}
  g.naturalChange={value:g.events.birth!.value-g.events.death!.value,source};
 }
}
async function bytes(path:string){return download(new URL(path,TOKYO_STAT));}
export async function fetchTokyoLatest(now:number):Promise<TokyoAreaSet>{
 const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Tokyo',year:'numeric'}).format(now)),yy=String(year).slice(2),last=year-1,ly=String(last).slice(2);
 const path=`/juukiy/${year}/jy${yy}qv0700.csv`,source=tokyoSource(TOKYO_STAT+path,`${year}-01`,'住民基本台帳による東京都の世帯と人口 第7表',now,'各年1月1日現在の住民基本台帳人口。区部、多摩（市部＋郡部）、島部。');
 const areas=registryAreas(await bytes(path),source);
 const flows=csv(await bytes(`/jugoki/${last}/ju${ly}qv0100.csv`));
 for(const area of TOKYO_AREAS){const value=AREA_CODES[area].reduce((sum,code)=>{const r=flows.find(r=>r[1]===code);if(!r)throw Error('東京都の面積が不足しています');return sum+count(r[16]);},0);const s=tokyoSource(`${TOKYO_STAT}/jugoki/${last}/ju${ly}q10000.htm`,`${last}-12`,'人口の動き 第1表・面積',now,'区部、市郡部、島部の面積。');areas[area].area={value,source:s};areas[area].density={value:areas[area].groups.total!.population!.value/value,source:{...source,scope:'総人口÷面積。面積の出典は別記。'}};}
 const movement=tokyoSource(`${TOKYO_STAT}/jidou/${last}/ji-data1.htm`,`${last}-12`,'東京都住民基本台帳人口移動報告 第9・12・13・14表',now,'日本国内（都内の他地域を含む）と国外との住所移転。移動による増減は転入－転出。職権消除等は含めない。区部の転入・転出は区部内の区間移動を控除。多摩・島部及び国籍別は内部移動を分離できる表が未取得のため純増減のみ掲載。');
 const input=Object.fromEntries(await Promise.all(Object.entries({inflow:'12',outflow:'13',international:'14',matrix:'09'}).map(async([k,n])=>[k,await bytes(`/jidou/${last}/ji${ly}qv${n}00.csv`)]))) as Parameters<typeof addTokyoMovement>[1];addTokyoMovement(areas,input,movement);
 // Discover the currently published vital-statistics release, rather than guessing its year.
 const healthRoot='https://www.hokeniryo.metro.tokyo.lg.jp';const index=new TextDecoder().decode(await download(new URL('/kiban/chosa_tokei/jinkodotaitokei',healthRoot)));const $=load(index);const releases=$('a[href]').toArray().map(a=>$(a).attr('href')!).filter(h=>/jinkodotaitokei\/reiwa\d+nen$/.test(h));const release=Math.max(...releases.map(h=>Number(h.match(/reiwa(\d+)nen$/)![1])+2018));if(!Number.isInteger(release)||release<2024)throw Error('東京都人口動態の公表年を特定できません');
 const healthPaths={birth:'01syussyou-1-csv',death:'03shibou-1-csv',marriage:'05konninnrikon-1-csv',fertility:'02goukei-1-csv'};const tables=Object.fromEntries(await Promise.all(Object.entries(healthPaths).map(async([k,p])=>[k,await download(new URL(`/documents/d/hokeniryo/${p}`,healthRoot))]))) as Parameters<typeof addTokyoHealth>[1];
 const historyPage=load(new TextDecoder().decode(await download(new URL('/kiban/chosa_tokei/jinkodotaitokei/kushityosonbetsu',healthRoot))));const publishedAt=historyPage('time[datetime]').first().attr('datetime');if(!publishedAt||!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt))throw Error('東京都人口動態の公表日が不明です');
 const health=tokyoSource(`${healthRoot}/kiban/chosa_tokei/jinkodotaitokei/kushityosonbetsu`,`${release}-12`,'人口動態統計 年次推移（区市町村別）',now,'日本における日本人の人口動態。出生・死亡・婚姻・離婚。');health.publishedAt=publishedAt;addTokyoHealth(areas,tables,release,health);
 const releaseUrl=new URL(releases.find(h=>Number(h.match(/reiwa(\d+)nen$/)![1])+2018===release)!,healthRoot);
 const releasePage=load(new TextDecoder().decode(await download(releaseUrl)));
 const supplements=releasePage('a[href]').toArray().filter(a=>releasePage(a).text().replace(/\s/g,'').startsWith('人口動態総覧（率）、区市町村別')).map(a=>releasePage(a).attr('href')!);
 if(supplements.length!==1)throw Error('東京都人口動態の率の付表が一意に確認できません');
 const fertilityUrl=new URL(supplements[0],healthRoot);
 const fertilityPublishedAt=releasePage('time[datetime]').first().attr('datetime');
 if(!fertilityPublishedAt||!/^\d{4}-\d{2}-\d{2}$/.test(fertilityPublishedAt))throw Error('東京都人口動態の率の付表の公表日が不明です');
 addTamaFertility(areas,await readTamaFertility(await download(fertilityUrl)),{...health,publishedAt:fertilityPublishedAt,url:fertilityUrl.href,table:'人口動態統計 付表 人口動態総覧（率）、区市町村別',scope:'日本人の合計特殊出生率。多摩（市部と郡部）の公表集計値。市部・郡部の率の加算や単純平均ではない。'});
 const registered=tokyoSource(`${TOKYO_STAT}/jugoki/${last}/ju${ly}q10000.htm`,`${last}-12`,'人口の動き 第15・16表',now,'住民基本台帳に基づく当年中の出生・死亡による人口増減。総数・日本人・外国人別。人口動態統計とは定義が異なります。');
 addTokyoRegisteredVital(areas,{birth:await bytes(`/jugoki/${last}/ju${ly}qv1500.csv`),death:await bytes(`/jugoki/${last}/ju${ly}qv1600.csv`)},registered);
 for(const area of TOKYO_AREAS)if(!areas[area].groups.total?.events?.marriage)throw Error('最新の東京都人口動態が不足しています');
 return areas;
}
