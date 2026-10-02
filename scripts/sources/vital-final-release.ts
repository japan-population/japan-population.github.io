import ExcelJS from 'exceljs';
import {download} from './http';
import {annualOfficialSchema,eventBreakdownsSchema,type AnnualOfficial,type EventBreakdowns,type Source} from '../../src/types/statistics';

// The September 2026 release precedes the update of the e-Stat time-series DB.
export const FINAL_2025_URL='https://www.mhlw.go.jp/toukei/saikin/hw/jinkou/kakutei25/xls/06_hyoR07.xlsx';
export async function parseFinal2025(bytes:Uint8Array,now:number){
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet=(name:string)=>{const s=book.getWorksheet(name);if(!s)throw new Error('2025年確定表のシートがありません');return s;};
  const text=(s:string,cell:string)=>sheet(s).getCell(cell).text.normalize('NFKC').replace(/\s/g,'').replaceAll('~','～');
  const number=(s:string,cell:string)=>{const v=sheet(s).getCell(cell).value;if(v==='-')return 0;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('2025年確定表の件数が不正です');return v;};
  for(const [s,c] of [['第１表','H5'],['第６表','C48'],['第７表','G4'],['第８表','D4']])if(!text(s,c).includes('2025'))throw new Error('確定表の対象年が一致しません');
  for(const [c,label] of [['C8','出生(人)'],['C11','死亡(人)'],['C24','婚姻(組)'],['C25','離婚(組)']])if(text('第１表',c)!==label)throw new Error('人口動態総覧の行が変わりました');
  const source=(table:string):Source=>({publisher:'厚生労働省',statistics:'令和7（2025）年 人口動態統計（確定数）の概況',table,sourcePeriod:'2025-12',publishedAt:'2026-09-30',retrievedAt:new Date(now).toISOString(),url:FINAL_2025_URL,status:'final',scope:'日本において発生した日本人の人口動態。2025年1～12月の確定数。'});
  const annual=annualOfficialSchema.parse({year:2025,source:source('第1表 人口動態総覧'),counts:{birth:number('第１表','H8'),death:number('第１表','H11'),marriage:number('第１表','H24'),divorce:number('第１表','H25')}});
  const ages=['14歳以下','15～19歳','20～24','25～29','30～34','35～39','40～44','45～49','50歳以上'];
  const motherAge=ages.map((label,i)=>{const row=53+i;if(text('第６表',`B${row}`)!==label)throw new Error('母の年齢階級が変わりました');return {label:label.includes('歳')?label:`${label}歳`,count:number('第６表',`C${row}`)};});
  const unknown=annual.counts.birth-motherAge.reduce((n,i)=>n+i.count,0);if(unknown<0||number('第６表','C51')!==annual.counts.birth)throw new Error('出生内訳の合計が不正です');
  motherAge.push({label:'不詳',count:unknown});
  const birthOrder=['第1子','第2子','第3子以上'].map((label,i)=>({label,count:number('第６表',`${['D','E','F'][i]}51`)}));
  const cause:EventBreakdowns[number]['items']=Array.from({length:10},(_,i)=>{const row=12+i,rank=number('第７表',`G${row}`);if(rank!==i+1)throw new Error('死因順位が変わりました');let label=text('第７表',`E${row}`);if(label==='心疾患')label='心疾患（高血圧性を除く）';if(label==='血管性等の認知症')label='血管性及び詳細不明の認知症';return {label,count:number('第７表',`H${row}`),rank};});
  const accident=cause.find(i=>i.label==='不慮の事故')!;
  const children:{label:string;count:number}[]=[];
  sheet('第８表').eachRow(row=>{if(/^2010[1-7]$/.test(row.getCell(2).text.trim()))children.push({label:text('第８表',`C${row.number}`),count:number('第８表',`D${row.number}`)});});
  if(children.length!==7)throw new Error('事故内訳が欠けています');
  accident.children=children;
  const supplements=[['20200','自殺'],['20300','他殺'],['20101','交通事故']].map(([code,label])=>{const rows:ExcelJS.Row[]=[];sheet('第８表').eachRow(row=>{if(row.getCell(2).text.trim()===code)rows.push(row);});if(rows.length!==1||!rows[0].getCell(3).text.includes(label))throw new Error('追加死因の分類が不明です');return {label,count:number('第８表',`D${rows[0].number}`),supplement:true};});
  if(number('第７表','H11')!==annual.counts.death||number('第８表','D8')!==annual.counts.death)throw new Error('死亡総数が一致しません');
  const common={year:2025,group:'japanese' as const};
  const breakdowns=eventBreakdownsSchema.parse([
    {...common,event:'birth',kind:'motherAge',total:annual.counts.birth,coverage:'complete',source:source('第6表 母の年齢（5歳階級）・出生順位別にみた出生数'),items:motherAge},
    {...common,event:'birth',kind:'birthOrder',total:annual.counts.birth,coverage:'complete',source:source('第6表 母の年齢（5歳階級）・出生順位別にみた出生数'),items:birthOrder},
    {...common,event:'death',kind:'cause',total:annual.counts.death,coverage:'partial',source:source('第7表 死因順位・第8表 死因簡単分類別死亡数'),items:[...cause,...supplements]},
  ]);
  return {annual,breakdowns};
}
export async function fetchFinal2025(now:number){return parseFinal2025(await download(new URL(FINAL_2025_URL)),now);}
export function mergeFinalRelease(annual:AnnualOfficial[],breakdowns:EventBreakdowns,release:Awaited<ReturnType<typeof parseFinal2025>>){
  // Prefer API details when available; never fill a missing 2025 category with 2024 counts.
  const existing=annual.find(s=>s.year===release.annual.year);
  if(existing&&Object.keys(release.annual.counts).some(k=>existing.counts[k as keyof typeof existing.counts]!==release.annual.counts[k as keyof typeof existing.counts]))throw new Error('確定数のAPI表と概況表が一致しません');
  return {annual:[...annual,...existing?[]:[release.annual]].sort((a,b)=>a.year-b.year),breakdowns:eventBreakdownsSchema.parse([...breakdowns,...release.breakdowns.filter(s=>!breakdowns.some(v=>v.year===s.year&&v.group===s.group&&v.event===s.event&&v.kind===s.kind))])};
}
