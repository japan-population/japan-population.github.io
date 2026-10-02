import { parse } from 'csv-parse/sync';
import { load } from 'cheerio';
import { download, downloadText } from './http';
import type { DistributionData, EventProfile, HolidayCalendar, WeightedProfile } from '../../src/types/distribution';
import { distributionDataSchema } from '../../src/types/distribution';
export const HOLIDAYS_URL='https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';
export function normalizeHolidays(bytes:Uint8Array,now:number):HolidayCalendar {
  const rows=parse(new TextDecoder('shift_jis').decode(bytes),{skip_empty_lines:true}) as string[][];
  if(!rows.shift()?.[0].includes('国民の祝日'))throw new Error('祝日CSVの表題が変わりました');
  const dates:Record<string,string>={};
  for(const [date,name] of rows){const m=date.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);if(!m||!name)throw new Error('祝日CSVが不正です');const key=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;if(dates[key]||new Date(`${key}T00:00:00Z`).toISOString().slice(0,10)!==key)throw new Error('祝日が重複・不正です');dates[key]=name;}
  if(!Object.keys(dates).length)throw new Error('祝日CSVが空です');
  const years=Object.keys(dates).map(k=>Number(k.slice(0,4)));const fromYear=Math.min(...years),throughYear=Math.max(...years);
  for(let y=Math.max(2020,fromYear);y<=throughYear;y++)if(Object.keys(dates).filter(d=>d.startsWith(`${y}-`)).length<10)throw new Error('祝日CSVの年が不完全です');
  return {sourceType:'official',url:HOLIDAYS_URL,fromYear,throughYear,dates,retrievedAt:new Date(now).toISOString()};
}
export function normalizeBirthDistribution(bytes:Uint8Array,year:number,url:string,publishedAt:string,calendar:HolidayCalendar):EventProfile {
  if(year<calendar.fromYear||year>calendar.throughYear)throw new Error('出生年の祝日が未収録です');
  const rows=parse(new TextDecoder('shift_jis').decode(bytes),{relax_column_count:true,skip_empty_lines:true}) as string[][];
  const clean=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
  if(!clean(rows[0]?.[0]??'').startsWith(`令和${year-2018}年`))throw new Error('出生時刻の統計年が不一致です');
  if(!rows.some(r=>r.join('').includes('出生月・出生日・出生時別')))throw new Error('出生時刻CSVの表題が変わりました');
  const header=rows.find(r=>clean(r[2]??'')==='0時');if(!header||Array.from({length:24},(_,h)=>clean(header[h+2]??'')).some((v,h)=>v!==`${h}時`))throw new Error('出生時刻の列が不正です');
  const counts:Record<string,number[]>={}, monthTotals:number[]=[], dates: {key:string;month:number;weekday:number;holiday:boolean;count:number;hours:number[]}[]=[];
  let month=0, place=false;
  for(const row of rows){const label=clean(row[0]);if(label.includes('*')){const parts=label.split('*');place=parts[0]==='総数';month=Number(parts[1].match(/^(\d{1,2})月$/)?.[1]??0);continue;}if(!place||!month)continue;
    const value=(s:string)=>{if(s==='-')return 0;const n=Number(s);if(!/^\d+$/.test(s)||!Number.isSafeInteger(n))throw new Error('出生時刻に欠損があります');return n;};
    if(label==='総数'){if(monthTotals[month-1]!==undefined)throw new Error('出生月が重複');monthTotals[month-1]=value(row[1]);continue;}
    const d=label.match(/^(\d{1,2})日$/);if(!d)continue;const day=Number(d[1]),stamp=new Date(Date.UTC(year,month-1,day));if(stamp.getUTCMonth()!==month-1)continue;
    const key=stamp.toISOString().slice(0,10);if(counts[key])throw new Error('出生日が重複');const hours=row.slice(2,26).map(value),count=value(row[1]);if(hours.length!==24||hours.reduce((a,b)=>a+b,0)>count)throw new Error('出生時刻の合計が不正');counts[key]=hours;dates.push({key,month,weekday:stamp.getUTCDay(),holiday:!!calendar.dates[key],count,hours});
  }
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  if(dates.length!==days||monthTotals.length!==12)throw new Error('出生の日別履歴が不完全です');
  for(let m=1;m<=12;m++)if(dates.filter(d=>d.month===m).reduce((n,d)=>n+d.count,0)!==monthTotals[m-1])throw new Error('出生の日・月合計が不一致です');
  const meta={sourceType:'derived' as const,sourceYear:year,url,publishedAt,description:`${year}年 人口動態統計 確定数 保管統計表 出生第7表。日本国内の日本人の出生。`};
  const hourly=(subset:typeof dates):WeightedProfile=>({...meta,description:meta.description+'出生時刻が判明した件数を正規化。不詳は既知の時刻分布へ比例配分。',weights:Array.from({length:24},(_,h)=>subset.reduce((n,d)=>n+d.hours[h],0))});
  const dailyFactor=(subset:typeof dates)=>subset.reduce((n,d)=>n+d.count/(monthTotals[d.month-1]/new Date(Date.UTC(year,d.month,0)).getUTCDate()),0)/subset.length;
  return {version:`birth-${year}-v1`,meaning:'Actual birth time, not registration time',monthlyProfile:{...meta,weights:monthTotals},daily:{...meta,description:meta.description+'各月の日平均に対する日別件数比を曜日・祝日別に平均。',weekdayWeights:Array.from({length:7},(_,w)=>dailyFactor(dates.filter(d=>!d.holiday&&d.weekday===w))),holidayWeight:dailyFactor(dates.filter(d=>d.holiday)),specialDates:{}},hourlyProfiles:{weekday:hourly(dates.filter(d=>!d.holiday&&d.weekday>0&&d.weekday<6)),saturday:hourly(dates.filter(d=>!d.holiday&&d.weekday===6)),sunday:hourly(dates.filter(d=>!d.holiday&&d.weekday===0)),holiday:hourly(dates.filter(d=>d.holiday))}};
}
export const birthListUrl=(year:number)=>new URL(`https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&tclass1=000001053058&tclass2=000001053061&tclass3=000001053073&tclass4=000001053075&toukei=00450011&tstat=000001028897&year=${year}0`);
export async function fetchDistribution(now:number):Promise<DistributionData>{
  const calendar=normalizeHolidays(await download(new URL(HOLIDAYS_URL)),now);
  const currentYear=Number(new Date(now+9*3600000).toISOString().slice(0,4));
  for(let year=currentYear-1;year>=currentYear-3;year--){
    const $=load(await downloadText(birthListUrl(year)));let file: {url:string;publishedAt:string}|undefined;
    $('article').each((_,a)=>{if(!$(a).text().includes('出生の場所・出生月・出生日・出生時別'))return;const href=$(a).find('a[data-file_type="CSV"]').attr('href'),date=$(a).text().match(/公開（更新）日\s*(\d{4}-\d{2}-\d{2})/)?.[1];if(!href||!date)throw new Error('出生時刻の公表情報が変わりました');file={url:new URL(href,'https://www.e-stat.go.jp').href,publishedAt:date};});
    if(file)return distributionDataSchema.parse({calendar,birthProfile:normalizeBirthDistribution(await download(new URL(file.url)),year,file.url,file.publishedAt,calendar)});
  }
  throw new Error('出生時刻統計の取得先が見つかりません');
}
