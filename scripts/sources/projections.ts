import ExcelJS from 'exceljs';
import {load} from 'cheerio';
import {download} from './http';
import {projectionsSchema,PROJECTION_LABELS,PROJECTION_YEARS,type Projections,type ProjectionScenario,type ProjectionDetail} from '../../src/types/projections';
export const PROJECTION_INDEX='https://www.ipss.go.jp/pp-zenkoku/j/zenkoku2023/db_zenkoku2023/db_zenkoku2023syosaikekka.html';
const ids={medium:1,high:2,low:3} as const;
type Group='total'|'japanese';
type Table='1'|'8'|'9A';
const clean=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
function persons(cell:ExcelJS.Cell){
 const n=cell.value;if(typeof n!=='number'||!Number.isFinite(n)||n<0||Math.abs(n*1000-Math.round(n*1000))>1e-5)throw new Error('将来推計に欠損または想定外の精度があります');
 return Math.round(n*1000);
}
export async function parseProjectionTable(bytes:Uint8Array,kind:Table,scenario:ProjectionScenario,group:Group){
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 const counts=new Map<number,number[]>(),details=new Map<number,ProjectionDetail>();
 for(const sheet of book.worksheets){
  const title=clean(sheet.getCell('A2').text),expected=`${PROJECTION_LABELS[scenario]}(死亡中位)推計`;
  if(!title.includes(expected)||!title.includes(group==='total'?'総人口':'日本人'))throw new Error('将来推計表のシナリオ・対象が変わりました');
  if(!clean(sheet.getCell(kind==='9A'?'B4':'C3').text).includes('(1,000人)'))throw new Error('将来推計表の公表単位が変わりました');
  if(kind==='9A'){
   let year=0;let current:ProjectionDetail|undefined;
   sheet.eachRow(row=>{
    const label=clean(row.getCell('A').text),y=label.match(/\((20\d{2}|21\d{2})\)年/);
    if(y){year=Number(y[1]);current=undefined;return;}
    if(!year)return;
    if(label==='総数'){
     if(details.has(year))throw new Error('将来年齢表の年が重複しています');
     current={population:persons(row.getCell('B')),male:persons(row.getCell('C')),female:persons(row.getCell('D')),ages:[]};details.set(year,current);return;
    }
    const m=label.match(/^(\d+)[~～](\d+)$/),start=m?Number(m[1]):label==='100+'?100:undefined;
    if(current&&start!==undefined&&(start===100||Number(m?.[2])===start+4)){
     if(start!==current.ages.length*5)throw new Error('将来人口の年齢階級が欠けています');
     current.ages.push([persons(row.getCell('B')),persons(row.getCell('C')),persons(row.getCell('D'))]);
    }
   });
  }else{
   if(!clean(sheet.getCell('C4').text).includes(kind==='1'?'総数':'出生')||kind==='8'&&!clean(sheet.getCell('D4').text).includes('死亡'))throw new Error('将来人口の列が変わりました');
   sheet.eachRow(row=>{
    const year=row.getCell('B').value;if(typeof year!=='number'||year<2020||year>2120||!Number.isInteger(year))return;
    if(counts.has(year))throw new Error('将来人口の年が重複しています');
    counts.set(year,kind==='1'?[persons(row.getCell('C'))]:[persons(row.getCell('C')),persons(row.getCell('D'))]);
   });
  }
 }
 if(kind==='9A'?[...details.values()].some(d=>d.ages.length!==21)||details.size<10:counts.size<50)throw new Error('将来推計の収録範囲が不足しています');
 return {counts,details};
}
export async function fetchProjections(now:number,get:typeof download=download):Promise<Projections>{
 const text=async(url:string)=>new TextDecoder().decode(await get(new URL(url)));
 const $=load(await text(PROJECTION_INDEX));
 const output={} as Projections['scenarios'];
 for(const scenario of ['medium','high','low'] as const){
  const sources:Projections['scenarios']['medium']['sources']=[];
  const parsed={} as Record<Group,Record<Table,Awaited<ReturnType<typeof parseProjectionTable>>>>;
  for(const group of ['total','japanese'] as const){
   const suffix=group==='japanese'?'_Japanese':'';
   const target=`db_r5_suikeikekka_${ids[scenario]}${suffix}.html`;
   const href=$('a').toArray().map(a=>$(a).attr('href')).find(h=>h?.endsWith(target));
   if(!href)throw new Error('将来推計の公式索引が変わりました');
   const page=new URL(href,PROJECTION_INDEX).href,links=load(await text(page));
   parsed[group]={} as typeof parsed[typeof group];
   for(const kind of ['1','8','9A'] as const){
    const combined={counts:new Map<number,number[]>(),details:new Map<number,ProjectionDetail>()};
    for(const long of [false,true]){
     const file=`${long?'s':''}${ids[scenario]}-${kind}${group==='japanese'?'(J)':''}.xlsx`;
     const link=links('a').toArray().map(a=>({href:links(a).attr('href'),label:links(a).text().trim()})).find(a=>a.href&&decodeURIComponent(a.href).endsWith('/'+file));
     if(!link?.href)throw new Error('将来推計のExcelリンクが変わりました');
     const url=new URL(link.href,page).href;
     const table=await parseProjectionTable(await get(new URL(url)),kind,scenario,group);
     for(const key of ['counts','details'] as const){
      // Some age tables repeat the boundary year. Only identical duplicates are allowed.
      for(const [year,value]of table[key]){
       const previous=combined[key].get(year);
       if(previous&&JSON.stringify(previous)!==JSON.stringify(value))throw new Error('基本推計と長期参考推計の境界が不一致です');
       if(key==='counts')combined.counts.set(year,value as number[]);else combined.details.set(year,value as ProjectionDetail);
      }
     }
     sources.push({url,table:link.label});
    }
    parsed[group][kind]=combined;
   }
  }
  const read=(g:Group,k:Table,y:number,i=0)=>{const n=parsed[g][k].counts.get(y)?.[i];if(n===undefined)throw new Error('将来推計の年次が欠落しています');return n;};
  output[scenario]={sources,points:Array.from({length:71},(_,i)=>{const year=2030+i;return {year,population:{total:read('total','1',year),japanese:read('japanese','1',year)},birth:{total:read('total','8',year),japanese:read('japanese','8',year)},death:{total:read('total','8',year,1),japanese:read('japanese','8',year,1)}};}),details:Object.fromEntries(PROJECTION_YEARS.map(year=>[year,{total:parsed.total['9A'].details.get(year),japanese:parsed.japanese['9A'].details.get(year)}])) as Projections['scenarios']['medium']['details']};
 }
 return projectionsSchema.parse({edition:'2023',baseDate:'2020-10-01',publishedAt:'2023-04-26',retrievedAt:new Date(now).toISOString(),methodUrl:'https://www.ipss.go.jp/pp-zenkoku/j/zenkoku2023/pp2023_gaiyou.pdf',scenarios:output});
}
