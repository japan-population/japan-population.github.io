import ExcelJS from 'exceljs';
import {download} from './http';
import {PREFECTURES} from '../../src/lib/prefectures';
import {populationGroups,type Source} from '../../src/types/statistics';
import type {RegionalTimeline} from '../../src/types/regional-timeline';
export const HISTORICAL_MIGRATION_URLS={domestic:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000032047081&fileKind=0',international:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000032047248&fileKind=0'};
// Both sources cover calendar 2020. Never substitute domestic-only migration for the combined measure.
export async function supplementRegionalMigration(timeline:RegionalTimeline,domestic:Uint8Array,international:Uint8Array,now:number){
 const counts:Record<string,Record<string,{inflow:number;outflow:number}>>={};
 for(const [kind,bytes,inCol,outCol]of [['domestic',domestic,10,13],['international',international,7,10]]as const){
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as never);const sheet=book.worksheets[0];
  if(!sheet.getCell(4,inCol).text.includes(kind==='domestic'?'他都道府県から':'国外から')||!sheet.getCell(4,outCol).text.includes(kind==='domestic'?'他都道府県への':'国外への')||sheet.getCell(5,inCol).text!=='総数')throw Error('過去の移動統計の列が変わりました');
  const seen=new Set<string>(),national:Record<string,{inflow:number;outflow:number}>={};
  sheet.eachRow(row=>{const code=row.getCell(5).text.padStart(5,'0');if(!/^\d{2}000$/.test(code))return;
   const group=({'移動者':'total','日本人移動者':'japanese','外国人移動者':'foreign'}as const)[row.getCell(2).text as '移動者'];if(!group)return;
   if(row.getCell(4).text!=='2020年')throw Error('過去の移動統計の年が不一致です');
   const key=code+'/'+group;if(seen.has(key))throw Error('過去の移動統計が重複しています');seen.add(key);
   const count=(col:number)=>{const v=row.getCell(col).value;if(v==='-')return 0;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('移動人数が不正です');return v;};
   const value={inflow:count(inCol),outflow:count(outCol)};
   if(code==='00000'){national[group]=value;return;}
   if(!PREFECTURES.some(p=>p.code===code.slice(0,2)))return;
   counts[key]??={};counts[key][kind]=value;
  });
  for(const group of populationGroups)for(const field of ['inflow','outflow']as const){
   const total=PREFECTURES.reduce((sum,p)=>sum+(counts[`${p.code}000/${group}`]?.[kind]?.[field]??NaN),0);
   if(total!==national[group]?.[field])throw Error('過去の移動統計の47都道府県と全国合計が一致しません');
  }
 }
 const source:Source={publisher:'総務省統計局',statistics:'住民基本台帳人口移動報告',table:'2020年年報 第1表・国外移動参考表',sourcePeriod:'2020-12',publishedAt:'2021-01-29',retrievedAt:new Date(now).toISOString(),url:'https://www.stat.go.jp/data/idou/2020np/jissu/youyaku/index.html',status:'final',scope:`2020年1～12月。他都道府県と国外との住所移転の合計。都道府県内移動、短期旅行、職権消除等は含まない。国内表：${HISTORICAL_MIGRATION_URLS.domestic} 国外表：${HISTORICAL_MIGRATION_URLS.international}`};
 for(const p of PREFECTURES)for(const group of populationGroups){const values=counts[`${p.code}000/${group}`],g=timeline.past[2020][p.code].groups[group]??={rows:[]};
  const inflow=values.domestic.inflow+values.international.inflow,outflow=values.domestic.outflow+values.international.outflow;
  g.events={...g.events,inflow:{value:inflow,source},outflow:{value:outflow,source}};g.migrationChange={value:inflow-outflow,source};
 }
}
export async function fetchRegionalMigrationHistory(timeline:RegionalTimeline,now:number){const [d,i]=await Promise.all(Object.values(HISTORICAL_MIGRATION_URLS).map(url=>download(new URL(url))));await supplementRegionalMigration(timeline,d,i,now);}
