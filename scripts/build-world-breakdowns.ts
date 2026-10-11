/** Manual offline import. WPP medium CSV.gz, mother-age XLSX, single-age deaths XLSX, WHO GHE2023 XLSX. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { eventBreakdownsSchema, type EventBreakdownData, type Source } from '../src/types/statistics';
const [csvFile,motherFile,deathFile,causeFile] = process.argv.slice(2);
if (!csvFile||!motherFile||!deathFile||!causeFile) throw new Error('Supply WPP CSV, mother-age workbook, death-age workbook and WHO cause workbook');
const rows = parse(gunzipSync(await readFile(csvFile)),{columns:true,bom:true}) as Record<string,string>[];
const base = JSON.parse(await readFile('src/data/world-population.json','utf8')).source as Source;
const retrievedAt = new Date().toISOString();
const excelBase = 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/EXCEL_FILES/';
const sources = {
  country: {...base,retrievedAt,table:'Country/area・Medium・Births',scope:'国連WPP2024の国・地域別出生推計。国籍別ではなく、各国・地域の人口統計上の出生です。実際の分娩場所を追跡するものではありません。同年の国・地域別構成比を世界の現在推計出生数へ適用。原表の丸め差を除くため、構成比の分母は国・地域別値の合計です。'},
  mother: {...base,retrievedAt,table:'FERT/04・Births by five-year age group of mother',url:excelBase+'3_Fertility/WPP2024_FERT_F04_BIRTHS_BY_5-YEAR_AGE_GROUPS_OF_MOTHER.xlsx',scope:'世界・中位推計の母の年齢別出生数（10～54歳、5歳階級）。同年の構成比を現在推計出生数へ適用。原表の丸め差を除くため年齢別値の合計を分母とします。'},
  death: {...base,retrievedAt,table:'MORT/01-1・Deaths by single age, both sexes',url:excelBase+'4_Mortality/WPP2024_MORT_F01_1_DEATHS_SINGLE_AGE_BOTH_SEXES.xlsx',scope:'世界・男女計・中位推計の各歳別死亡数を5歳階級（100歳以上は一括）へ集計。同年の構成比を現在推計死亡数へ適用。原表の丸め差を除くため年齢別値の合計を分母とします。'},
  cause: {publisher:'世界保健機関（WHO）',statistics:'Global Health Estimates 2023',table:'Global 2023 / Top20・Both sexes, all ages',sourcePeriod:'2023-12',publishedAt:'2026-09',retrievedAt,url:'https://cdn.who.int/media/docs/default-source/gho-documents/global-health-estimates/deaths_global_2026-09-30.xlsx?sfvrsn=22004518_1',status:'reference' as const,scope:'WHOの2023年世界死因構成比を、国連WPPによる現在推計死亡数へ適用した参考推計。2026年の死因実績ではありません。全死因を分母とする構成比です。画面には上位10死因と自殺・他殺（対人暴力）を表示します。WHOと国連で死亡総数・対象範囲・推計方法が異なります。'},
};
async function worldRows(file:string) {
  const result = new Map<number,number[]>();
  const book = new ExcelJS.stream.xlsx.WorkbookReader(file,{sharedStrings:'cache',styles:'ignore',hyperlinks:'ignore'});
  for await (const sheet of book) for await (const row of sheet) {
    if ((sheet as unknown as {name:string}).name!=='Medium variant'||row.getCell(5).value!==900) continue;
    const year=Number(row.getCell(11).value);
    if(year>=2024&&year<=2100) result.set(year,(row.values as ExcelJS.CellValue[]).slice(12).map(v=>{
      if(typeof v!=='number'||!Number.isFinite(v)||v<0) throw new Error('Invalid WPP age count');
      return Math.round(v*1000);
    }));
  }
  if(result.size!==77) throw new Error('Missing WPP world age years');
  return result;
}
const motherRows=await worldRows(motherFile),deathRows=await worldRows(deathFile);
const who=new ExcelJS.Workbook();await who.xlsx.readFile(causeFile);
const top=who.getWorksheet('Top20')!,all=who.getWorksheet('Global 2023')!;
if(top.getCell('A6').value!==2023||all.getCell('F4').value!==2023) throw new Error('Unexpected WHO edition');
const translations:Record<string,string>={
  'Ischaemic heart disease':'虚血性心疾患','Stroke':'脳卒中','Chronic obstructive pulmonary disease':'慢性閉塞性肺疾患',
  'Lower respiratory infections':'下気道感染症','Alzheimer disease and other dementias':'アルツハイマー病およびその他の認知症',
  'Diabetes mellitus':'糖尿病','Trachea, bronchus, lung cancers':'気管・気管支・肺のがん','Hypertensive heart disease':'高血圧性心疾患',
  'Kidney diseases':'腎疾患','Diarrhoeal diseases':'下痢性疾患',
};
const causeItems:EventBreakdownData['items']=[];
for(let row=9;row<=18;row++){
 const label=translations[String(top.getCell(`B${row}`).value)];
 if(!label) throw new Error('Unknown WHO top-ten cause');
 causeItems.push({label,count:Math.round(Number(top.getCell(`C${row}`).value)*1000),rank:row-8});
}
for(const [code,label] of [[1610,'自殺'],[1620,'他殺'],[1530,'道路交通事故']] as const){
 let count:number|undefined;
 all.eachRow(row=>{if(row.getCell(1).value===code) count=Math.round(Number(row.getCell(7).value));});
 if(count===undefined) throw new Error('Missing WHO supplementary cause');
 causeItems.push({label,count});
}
const causeTotal=Math.round(Number(all.getCell('G10').value));
causeItems.push({label:'その他',count:causeTotal-causeItems.reduce((sum,i)=>sum+i.count,0)});
const cause:EventBreakdownData={event:'death',year:2023,group:'total',kind:'cause',source:sources.cause,total:causeTotal,coverage:'complete',items:causeItems};
const names=new Intl.DisplayNames('ja',{type:'region'});
const files = new Map<number,string>();
for(let year=2024;year<=2100;year++){
 const yearly=rows.filter(r=>r.Time===String(year)&&r.Variant==='Medium');
 const world=yearly.find(r=>r.LocID==='900')!;
 const countries=yearly.filter(r=>r.ISO3_code).map(r=>({label:r.ISO3_code==='XKX'?'コソボ':names.of(r.ISO2_code)||r.Location,count:Math.round(Number(r.Births)*1000)})).sort((a,b)=>b.count-a.count);
 const mother=motherRows.get(year)!,death=deathRows.get(year)!;
 if(countries.length!==237||mother.length!==9||death.length!==101) throw new Error(`Unexpected dimensions: ${year}`);
 const deathItems=Array.from({length:21},(_,i)=>({label:i===20?'100歳以上':`${i*5}～${i*5+4}歳`,count:death.slice(i*5,i===20?101:i*5+5).reduce((a,b)=>a+b,0)}));
 const make=(kind:'birthCountry'|'motherAge'|'deathAge',items:EventBreakdownData['items'],source:Source):EventBreakdownData=>{
   const total=items.reduce((s,i)=>s+i.count,0),event=kind==='deathAge'?'death':'birth';
   if(Math.abs(total-Number(world[event==='death'?'Deaths':'Births'])*1000)>500) throw new Error(`Breakdown does not reconcile: ${year} ${kind}`);
   return {event,year,group:'total',kind,source:{...source,sourcePeriod:`${year}-12`,scope:`${year}年の中位推計。${source.scope}`},total,coverage:'complete',items};
 };
 const sections=eventBreakdownsSchema.parse([
   make('birthCountry',countries,sources.country),
   make('motherAge',mother.map((count,i)=>({label:`${10+i*5}～${14+i*5}歳`,count})),sources.mother),
   cause,make('deathAge',deathItems,sources.death),
 ]);
 files.set(year,JSON.stringify(sections)+'\n');
}
// Validate every year before writing any output. These files are manual-only,
// outside public/data so the scheduled Japanese dataset update cannot remove them.
await mkdir('public/world-breakdowns',{recursive:true});
for(const [year,content] of files) await writeFile(`public/world-breakdowns/${year}.json`,content);
console.log(`Validated world breakdowns for ${files.size} years`);
