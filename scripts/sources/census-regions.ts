import ExcelJS from 'exceljs';
import { download } from './http';
import { PREFECTURES } from '../../src/lib/prefectures';
import type { Prefecture, Source } from '../../src/types/statistics';
export const CENSUS_REGIONS_URL = 'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040506634';
export type OfficialRegions = Record<string, NonNullable<Prefecture['officialPopulation']>>;
export async function normalizeCensusRegions(bytes: Uint8Array, now: number): Promise<OfficialRegions> {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet = book.worksheets[0];
  if (!sheet?.getCell('A1').text.normalize('NFKC').includes('【原数値】令和7年国勢調査') || !sheet.getCell('A2').text.includes('国籍（中区分）別人口')) throw new Error('国勢調査の表題が不一致です');
  const columns = {total:4,foreign:5,japanese:57,unknown:58};
  for (const [column,label] of [[4,'0_総数'],[5,'1_外国人'],[57,'2_日本人'],[58,'3_日本人・外国人の別「不詳」']] as const) {
    if(sheet.getCell(7,column).text!==label || sheet.getCell(9,column).text!=='人') throw new Error('国勢調査の列・単位が変わりました');
  }
  const result: OfficialRegions = {}, totals: Record<string,number> = {};
  sheet.eachRow(row=>{
    if(row.getCell(2).text!=='0_総数'||row.getCell(3).text!=='00_総数')return;
    const match=row.getCell(1).text.match(/^(\d{2})000_(.+)$/); if(!match)return;
    const code=match[1];
    if(code!=='00'&&!PREFECTURES.some(p=>p.code===code&&p.name===match[2])) throw new Error('国勢調査の地域が不明です');
    const values=Object.fromEntries(Object.entries(columns).map(([k,c])=>{const v=row.getCell(c).value;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('国勢調査に欠損・不正な人口があります');return[k,v];}));
    if(values.total!==values.japanese+values.foreign+values.unknown)throw new Error('国勢調査の国籍別人口の合計が不一致です');
    if(code==='00'){Object.assign(totals,values);return;}
    if(result[code])throw new Error('国勢調査の都道府県が重複しています');
    const source: Source={publisher:'総務省統計局',statistics:'令和7年国勢調査',table:'人口等基本集計 第56表（原数値）',sourcePeriod:'2025-10',publishedAt:'2026-09-29',retrievedAt:new Date(now).toISOString(),url:CENSUS_REGIONS_URL,status:'final',scope:'2025年10月1日現在。公表単位：人。総人口には日本人・外国人の別「不詳」を含み、日本人と外国人の合計とは一致しない場合があります。'};
    result[code]={total:{value:values.total,source},japanese:{value:values.japanese,source},foreign:{value:values.foreign,source}};
  });
  if(Object.keys(result).length!==47)throw new Error('国勢調査の都道府県が47件ありません');
  for(const group of ['total','japanese','foreign'] as const) if(Object.values(result).reduce((n,r)=>n+r[group].value,0)!==totals[group])throw new Error('国勢調査の全国・都道府県合計が不一致です');
  return result;
}
export async function fetchCensusRegions(now:number) {return normalizeCensusRegions(await download(new URL(CENSUS_REGIONS_URL)),now);}
