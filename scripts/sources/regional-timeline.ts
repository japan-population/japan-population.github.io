import ExcelJS from 'exceljs';
import {download} from './http';
import {PREFECTURES} from '../../src/lib/prefectures';
import {REGIONAL_PAST_YEARS,regionalTimelineSchema,type RegionalTimeline,type RegionalSnapshot} from '../../src/types/regional-timeline';
import type {Source,Breakdown} from '../../src/types/statistics';
export const REGIONAL_HISTORY_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000001085927&fileKind=0';
export const REGIONAL_PROJECTION_URL='https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/3kekka/suikei_kekka.xlsx';
const count=(v:ExcelJS.CellValue)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('地域人口の値が不正です');return v;};
function average(rows:Breakdown['rows'],source:Source){
 const ages=rows.filter(r=>r.sex==='男女計'&&/^\d/.test(r.age));
 const denominator=ages.reduce((s,r)=>s+r.value,0);
 // Five-year midpoint approximation; the open upper band uses its lower bound + 2.5.
 return denominator?{value:ages.reduce((s,r)=>s+(parseInt(r.age)+2.5)*r.value,0)/denominator,source:{...source,scope:source.scope+' 平均年齢は年齢既知人口の階級中央値（最上位も下限＋2.5歳）から算出した参考値。'},reference:true}:undefined;
}
function makeGroup(rows:Breakdown['rows'],source:Source):NonNullable<RegionalSnapshot['groups']['total']> & {population:{value:number;source:Source;reference?:boolean}}{
 const metric=(sex:string)=>{const r=rows.find(r=>r.sex===sex&&r.age==='総数');if(!r)throw Error('地域人口総数が欠けています');return {value:r.value,source};};
 const total=metric('男女計'),male=metric('男'),female=metric('女');if(total.value!==male.value+female.value)throw Error('男女計が不一致です');
 return {population:total,male,female,rows,averageAge:average(rows,source)};
}
export async function normalizeRegionalTimeline(history:Uint8Array,projection:Uint8Array,now:number):Promise<RegionalTimeline>{
 const past:RegionalTimeline['past']={},future:RegionalTimeline['future']={};
 const h=new ExcelJS.Workbook();await h.xlsx.load(history as never);const s=h.worksheets[0];
 if(!s.getCell('A2').text.includes('都道府県'))throw Error('国勢調査の地域表が変わりました');
 for(const year of REGIONAL_PAST_YEARS){
  past[year]={};const col=3+(year-1920)/5*7;
  if(s.getCell(11,col).text!==`${year}年`||s.getCell(14,col).text==='※')throw Error('国勢調査の原数値の年列が不正です');
  for(const p of PREFECTURES){
   const rows:Breakdown['rows']=[];
   s.eachRow(r=>{if(r.getCell(1).text!==`${p.code}000_${p.name}`)return;
    let age=r.getCell(2).text.replace(/\s/g,'').replace(/（.*?）$/,'');if(!/^(総数|\d+～\d+歳|\d+歳以上)$/.test(age))return;
    if(age==='80～84歳'&&[1920,1930,1950].includes(year)&&!(p.code==='47'&&year===1950))age='80歳以上';
    if(age==='70～74歳'&&p.code==='47'&&year===1950)age='70歳以上';
    for(const [i,sex]of (['男女計','男','女']as const).entries()){const raw=r.getCell(col+i).value;if(raw===null||typeof raw==='string'&&/^[-…・.]+$/.test(raw.trim()))continue;rows.push({group:'total',sex,age,value:count(raw)});}
   });
   const source:Source={publisher:'総務省統計局',statistics:'国勢調査 時系列データ',table:'第3表 年齢（5歳階級），男女別人口及び人口性比 — 都道府県',sourcePeriod:`${year}-10`,publishedAt:'2022-03-31',retrievedAt:new Date(now).toISOString(),url:REGIONAL_HISTORY_URL,status:'final',scope:'各年の公表原数値（国籍不詳・年齢不詳を総数に含む）。1950年・1960年・1970年の沖縄は当時の調査による。調査範囲・上位年齢階級は原表に従う。'};
   past[year][p.code]={year,status:'final',groups:{total:makeGroup(rows,source)}};
  }
 }
 const b=new ExcelJS.Workbook();await b.xlsx.load(projection as never);const ps=b.worksheets[0];
 if(!ps.getCell('A1').text.includes('男女5歳階級'))throw Error('地域将来推計の表構造が変わりました');
 ps.eachRow(r=>{if(r.getCell(2).text!=='a')return;const year=parseInt(r.getCell(5).text);if(![2030,2040,2050].includes(year))return;
  const code=String(count(r.getCell(1).value)).padStart(5,'0').slice(0,2);if(!PREFECTURES.some(p=>p.code===code))throw Error('地域コードが不正です');
  const rows:Breakdown['rows']=[];
  for(const [i,sex]of (['男女計','男','女']as const).entries())for(let a=0;a<=20;a++){const col=6+i*22+a;const age=a===0?'総数':ps.getCell(5,col).text.replace('95歳～','95歳以上');rows.push({group:'total',sex,age,value:count(r.getCell(col).value)});}
  const source:Source={publisher:'国立社会保障・人口問題研究所',statistics:'日本の地域別将来推計人口（令和5年推計）',table:'男女・年齢（5歳）階級別将来推計人口',sourcePeriod:`${year}-10`,publishedAt:'2023-12-22',retrievedAt:new Date(now).toISOString(),url:REGIONAL_PROJECTION_URL,status:'projection',scope:'2020年国勢調査を基準とする各年10月1日の総人口。日本人・外国人別の推計値は公表されていません。'};
  future[year]??={};future[year][code]={year,status:'projection',groups:{total:makeGroup(rows,source)}};
 });
 for(const records of [...Object.values(past),...Object.values(future)])if(Object.keys(records).length!==47)throw Error('地域時系列の47都道府県が揃いません');
 return regionalTimelineSchema.parse({past,future});
}
export async function fetchRegionalTimeline(now:number,appId:string){const [h,p]=await Promise.all([download(new URL(REGIONAL_HISTORY_URL)),download(new URL(REGIONAL_PROJECTION_URL))]);const result=await normalizeRegionalTimeline(h,p,now);const tables=await fetchRegionalSupplementTables(appId,now);supplementRegionalNationalities(result,tables);supplementRegionalForeignTotals(result,tables);supplementRegionalVital(result,tables);supplementRegionalIndicators(result,tables);return result;}

export const REGIONAL_VITAL_TABLES={birth:'0003411597',death:'0003411654',marriage:'0003411835',divorce:'0003411861'} as const;
export function supplementRegionalVital(timeline:RegionalTimeline,tables:Record<string,import('./table').Table>){
 for(const [kind,id]of Object.entries(REGIONAL_VITAL_TABLES)){
  const table=tables[id];if(!table)throw Error('地域人口動態の表が欠けています');
  const area=table.classes.find(c=>c['@id']==='area'||c['@name']==='都道府県');if(!area)throw Error('地域人口動態の地域区分が不明です');
  for(const row of table.values){
   const year=Number(labelFor(table,'time',row).replace('年','')),code=row[`@${area['@id']}`]?.slice(0,2);
   const snapshot=timeline.past[year]?.[code];if(!snapshot||!/^\d+$/.test(row.$))continue;
   const source:Source={...table.source,sourcePeriod:`${year}-12`,scope:'日本における日本人の年間人口動態。出典表の各年の集計範囲による。'};
   // Total view explicitly labels these Japanese-only observations.
   for(const group of ['total','japanese']as const){snapshot.groups[group]??={rows:[]};const g=snapshot.groups[group]!;g.events??={};g.events[kind as keyof NonNullable<typeof g.events>]={value:Number(row.$),source};}
  }
 }
 for(const records of Object.values(timeline.past))for(const snapshot of Object.values(records))for(const g of Object.values(snapshot.groups))if(g.events?.birth&&g.events.death)g.naturalChange={value:g.events.birth.value-g.events.death.value,source:g.events.birth.source};
}
import {CENSUS_TABLES,normalizeCensusTable} from './official-archive';
import {fetchTable,dimension,parameter,codeFor,clean,labelFor,type Table} from './table';
import {arrayOf} from './estat';
export const REGIONAL_CENSUS_IDS=['0000032875','0003038640','0003445217'] as const;
export function supplementRegionalNationalities(timeline:RegionalTimeline,tables:Record<string,Table>){
 for(const id of REGIONAL_CENSUS_IDS){
  const config=CENSUS_TABLES.find(c=>c.id===id)!;const table=tables[id];if(!table)throw Error('地域国勢調査の表が欠けています');
  for(const p of PREFECTURES){
   const values=table.values.filter(r=>r['@area']===`${p.code}000`).map(r=>r.$==='-'?{...r,$:'0'}:r);
   const normalized=normalizeCensusTable({...table,values},config)[0];if(!normalized)throw Error('地域国勢調査の値が欠けています');
   const snapshot=timeline.past[normalized.year][p.code];
   for(const group of ['total','japanese','foreign']as const){const g=normalized.groups[group];if(!g)continue;
    if(group==='total'){if(g.population!==snapshot.groups.total?.population?.value)throw Error('地域国勢調査の総数が時系列と不一致です');if(g.rows.length<=snapshot.groups.total.rows.length)continue;}
    const source:Source={...g.source,scope:`${p.name}の国勢調査公表原数値。総人口には国籍不詳を含むため、日本人と外国人の合計と一致しない場合があります。`};
    snapshot.groups[group]=makeGroup(g.rows,source);
   }
  }
 }
}
export async function fetchRegionalSupplementTables(appId:string,now:number){
 const tables:Record<string,Table>={};
 for(const id of REGIONAL_CENSUS_IDS){const config=CENSUS_TABLES.find(c=>c.id===id)!;
  tables[id]=await fetchTable(id,appId,now,'国勢調査',classes=>{
   const area=classes.find(c=>c['@id']==='area')!;const filters:Record<string,string>={cdArea:arrayOf(area.CLASS).filter(v=>/^(0[1-9]|[1-3]\d|4[0-7])000$/.test(v['@code'])).map(v=>v['@code']).join(',')};
   for(const label of ['人口','全域']){const c=classes.find(c=>arrayOf(c.CLASS).some(v=>clean(v['@name'])===label));if(c)filters[parameter(c['@id'])]=codeFor(c,label);}
   const age=dimension(classes,'ageLabel'in config?config.ageLabel:'0～4歳');filters[parameter(age['@id'])]=arrayOf(age.CLASS).filter(v=>/^(総数.*|\d+～\d+歳|\d+歳以上)$/.test(clean(v['@name']))).map(v=>v['@code']).join(',');
   if('marker'in config){const nat=dimension(classes,config.marker);filters[parameter(nat['@id'])]=arrayOf(nat.CLASS).filter(v=>clean(v['@name'])in config.groups).map(v=>v['@code']).join(',');}
   return filters;
  });
 }
 for(const [kind,id]of Object.entries(REGIONAL_VITAL_TABLES))tables[id]=await fetchTable(id,appId,now,'人口動態統計 確定数',classes=>{
  const label=({birth:'出生数',death:'死亡数',marriage:'婚姻件数',divorce:'離婚件数'} as Record<string,string>)[kind],tab=dimension(classes,label),time=classes.find(c=>c['@id']==='time')!;
  return {[parameter(tab['@id'])]:codeFor(tab,label),cdTime:arrayOf(time.CLASS).filter(v=>REGIONAL_PAST_YEARS.includes(Number(clean(v['@name']).replace('年','')))).map(v=>v['@code']).join(',')};
 });
 for(const {id}of REGIONAL_FOREIGN_TABLES)tables[id]=await fetchTable(id,appId,now,'国勢調査',classes=>{
  const nat=classes.find(c=>c['@name'].includes('国籍'))!;const filters:Record<string,string>={[parameter(nat['@id'])]:'000',cdArea:PREFECTURES.map(p=>`${p.code}000`).join(',')};
  const area=classes.find(c=>arrayOf(c.CLASS).some(v=>clean(v['@name'])==='全域'));if(area)filters[parameter(area['@id'])]=codeFor(area,'全域');return filters;
 });
 for(const id of ['0003410212','0003411598','0003445099'])tables[id]=await fetchTable(id,appId,now,id!=='0003411598'?'国勢調査':'人口動態統計 確定数',(classes):Record<string,string>=>id==='0003445099'?{cdArea:PREFECTURES.map(p=>`${p.code}000`).join(','),cdTab:arrayOf(classes.find(c=>c['@id']==='tab')!.CLASS).filter(v=>/面積|人口密度/.test(v['@name'])).map(v=>v['@code']).join(',')}:{});
 return tables;
}

export const REGIONAL_FOREIGN_TABLES=[{id:'0000030133',year:1980},{id:'0000031395',year:1990},{id:'0000033604',year:2000}] as const;
export function supplementRegionalForeignTotals(timeline:RegionalTimeline,tables:Record<string,Table>){
 for(const {id,year}of REGIONAL_FOREIGN_TABLES){const table=tables[id];if(!table)throw Error('外国人人口の表が欠けています');
  const sex=dimension(table.classes,'男')['@id'];
  for(const p of PREFECTURES){const snapshot=timeline.past[year][p.code];const rows:Breakdown['rows']=table.values.filter(r=>r['@area']===`${p.code}000`).map(r=>{const s=labelFor(table,sex,r),raw=r.$==='-'?'0':r.$;if(!/^\d+$/.test(raw))throw Error('外国人人口の値が不正です');return {group:'foreign',sex:s==='男'?'男':s==='女'?'女':'男女計',age:'総数',value:Number(raw)};});
   if(rows.length!==3)throw Error('外国人人口の男女が欠けています');
   const source:Source={...table.source,sourcePeriod:`${year}-10`,scope:`${p.name}の国勢調査による外国人人口（公表原数値）。`};
   snapshot.groups.foreign=makeGroup(rows,source);
   if(year<=1990){const total=snapshot.groups.total!;const jrows=rows.map(r=>({...r,group:'japanese' as const,value:total.rows.find(t=>t.age==='総数'&&t.sex===r.sex)!.value-r.value}));const j=makeGroup(jrows,{...source,scope:'国勢調査の総人口から外国人人口を差し引いた参考値。国籍不詳を含む場合があります。年齢別内訳は算出しません。'})!;j.population.reference=true;if(j.male)j.male.reference=true;if(j.female)j.female.reference=true;snapshot.groups.japanese=j;}
  }
 }
}
export function supplementRegionalIndicators(timeline:RegionalTimeline,tables:Record<string,Table>){
 for(const id of ['0003410212','0003411598','0003445099']){
  const table=tables[id];if(!table)throw Error('地域指標の表が欠けています');
  const area=table.classes.find(c=>c['@id']==='area'||c['@name']==='都道府県'||c['@name'].startsWith('地域'))!;
  for(const row of table.values){const year=Number(labelFor(table,'time',row).replace('年','')),code=row[`@${area['@id']}`]?.slice(0,2),s=timeline.past[year]?.[code];if(!s||!/^\d+(\.\d+)?$/.test(row.$))continue;
   const source:Source={...table.source,publisher:id!=='0003411598'?'総務省統計局':'厚生労働省',statistics:id!=='0003411598'?'国勢調査':'人口動態統計 確定数',sourcePeriod:`${year}-${id!=='0003411598'?'10':'12'}`,scope:id!=='0003411598'?'各調査年の面積と公表人口密度。密度は調査対象外地域の面積を除外して計算。':'日本人に関する都道府県別の合計特殊出生率。'};
   const metric={value:Number(row.$),source};
   if(id==='0003411598'){s.groups.japanese??={rows:[]};for(const g of ['total','japanese']as const)s.groups[g]!.fertilityRate=metric;}
   else{const label=labelFor(table,'tab',row);if(label.startsWith('面積'))s.area=metric;else if(label==='人口密度')s.density=metric;}
  }
 }
}
