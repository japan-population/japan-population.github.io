import ExcelJS from 'exceljs';
import {download} from './http';
import type {ExactHistory} from './exact-population';
import {populationTrendSchema,type PopulationTrend,type Source} from '../../src/types/statistics';
export const TREND_FILES=[
  {url:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000000090261&fileKind=0',publishedAt:'2007-12-18',sourcePeriod:'2000-10',table:'長期時系列 第1表（1920～2000年）',scope:'公表単位は千人。1940年は国勢調査を補正した人口。1945年は11月1日現在。1945～1971年は沖縄を含まない。日本人人口は1950年以降のみ。'},
  {url:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000013168601&fileKind=4',publishedAt:'2022-07-20',sourcePeriod:'2020-10',table:'長期時系列 第1表（2000～2020年）',scope:'公表単位は千人。国勢調査間は公式の補間補正人口。日本人人口には国籍不詳の按分値・不詳補完値を含む。'},
  {url:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040206125&fileKind=4',publishedAt:'2024-09-20',sourcePeriod:'2023-10',table:'参考表 全国人口の推移（年次欄）',scope:'各年10月1日現在の確定値（1人単位）。日本人人口は国籍不詳の按分・補完後。外国人人口は同じ表の総人口と日本人人口の差。'},
]as const;
export function trendSource(index:number,now:number):Source{return {...TREND_FILES[index],publisher:'総務省統計局',statistics:'人口推計',status:'final',retrievedAt:new Date(now).toISOString()};}
type Point=PopulationTrend['points'][number];
export async function normalizeAnnualPopulation(bytes:Uint8Array,sourceIndex:number,reference=false):Promise<Point[]>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  const rows=new Map<number,Point>();
  for(const sheet of book.worksheets){
    const heading=[sheet.getCell('A1').text,sheet.getCell('I1').text,sheet.getCell('O1').text].join('').replace(/\s/g,'');
    if(!(reference?heading.includes('全国人口の推移'):heading.includes('男女別人口')))throw new Error('年次人口表のタイトルが変わりました');
    const modern=typeof sheet.getCell('A11').value==='number';
    const yearColumn=reference||modern?'A':'B',totalColumn=modern?'C':'D',japaneseColumn=reference?'R':modern?'F':'G';
    if(!reference&&!sheet.getCell('A5').text.includes('千人'))throw new Error('年次人口の単位が変わりました');
    if(reference&&!sheet.getCell('F4').text.replace(/\s/g,'').includes('総人口')||!sheet.getCell(reference?'T4':`${japaneseColumn}7`).text.replace(/\s/g,'').includes('日本人人口'))throw new Error('年次人口の列構成が変わりました');
    sheet.eachRow(row=>{
      const rawYear=row.getCell(yearColumn).value;
      const year=reference?Number(String(rawYear).trim().match(/^(\d{4})年$/)?.[1]):rawYear;
      if(typeof year!=='number'||!Number.isInteger(year)||year<1920||year>2100)return;
      const total=row.getCell(totalColumn).value,japanese=row.getCell(japaneseColumn).value;
      if(reference&&total===null)return; // Monthly subsection's year headings have no population.
      if(typeof total!=='number'||!Number.isSafeInteger(total)||total<=0)throw new Error('年次総人口が不正です');
      const precision=reference?1:1000;
      const point:Point={date:`${year}-${year===1945?'11':'10'}-01`,total:total*precision,precision,sourceIndex};
      if(typeof japanese==='number'){
        if(!Number.isSafeInteger(japanese)||japanese<0||japanese>total)throw new Error('年次日本人人口が不正です');
        point.japanese=japanese*precision;point.foreign=point.total-point.japanese;
      }else if(year>=1950)throw new Error('年次国籍別人口が欠けています');
      const previous=rows.get(year);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(point))throw new Error('年次人口が重複・不一致です');
      rows.set(year,point);
    });
  }
  if(rows.size<(reference?9:21))throw new Error('年次人口の収録年が不足しています');
  return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function mergePopulationTrend(tables:Point[][],sources:Source[],exact:ExactHistory):PopulationTrend{
  const points=new Map<number,Point>();
  for(const table of tables)for(const point of table)points.set(Number(point.date.slice(0,4)),point);
  const latest=exact.total.at(-1);if(!latest)throw new Error('最新確定人口がありません');
  const resultSources=[...sources,{...latest.source}];
  for(const row of exact.total){
    if(!row.month.endsWith('-10')&&row!==latest)continue;
    const japanese=exact.japanese.find(r=>r.month===row.month),foreign=exact.foreign.find(r=>r.month===row.month);
    if(!japanese||!foreign||row.value!==japanese.value+foreign.value)throw new Error('年次人口の国籍別合計が不一致です');
    points.set(Number(row.month.slice(0,4)),{date:`${row.month}-01`,total:row.value,japanese:japanese.value,foreign:foreign.value,precision:1,sourceIndex:sources.length});
  }
  return populationTrendSchema.parse({sources:resultSources,points:[...points.values()].sort((a,b)=>a.date.localeCompare(b.date))});
}
export async function fetchPopulationTrend(exact:ExactHistory,now:number):Promise<PopulationTrend>{
  const tables=[];
  for(const [i,file]of TREND_FILES.entries())tables.push(await normalizeAnnualPopulation(await download(new URL(file.url)),i,i===2));
  const latest=exact.total.at(-1);if(!latest)throw new Error('最新確定人口がありません');
  const sources=TREND_FILES.map((_,i)=>trendSource(i,now));
  // Read annual rows as well as the rolling monthly history, so older October
  // observations do not disappear when the monthly window advances.
  const annual=await normalizeAnnualPopulation(await download(new URL(latest.source.url)),sources.length,true);
  tables.push(annual);
  sources.push({...latest.source,table:'参考表 全国人口の推移（年次欄）',sourcePeriod:annual.at(-1)!.date.slice(0,7)});
  return mergePopulationTrend(tables,sources,exact);
}
