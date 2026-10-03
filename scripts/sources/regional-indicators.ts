import ExcelJS from 'exceljs';
import {PREFECTURES} from '../../src/lib/prefectures';
import {populationGroups,type RegionalDetail,type PopulationGroup,type Source} from '../../src/types/statistics';
import {download} from './http';
export const REGIONAL_AGE_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040506621&fileKind=0';
export const REGIONAL_RATE_URL='https://www.mhlw.go.jp/toukei/saikin/hw/jinkou/kakutei24/xls/16_hyoR06.xlsx';
async function sheet(bytes:Uint8Array,name?:string){const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);const result=name?book.getWorksheet(name):book.worksheets[0];if(!result)throw new Error('地域指標の統計表がありません');return result;}
function value(cell:ExcelJS.Cell,max:number){if(typeof cell.value!=='number'||!Number.isFinite(cell.value)||cell.value<0||cell.value>max)throw new Error('地域指標に欠損・不正な値があります');return cell.value;}
/** Published averages, not midpoints estimated from the five-year pyramid. */
export async function addRegionalIndicators(regions:Record<string,RegionalDetail>,ageBytes:Uint8Array,rateBytes:Uint8Array,now:number){
  const [ages,rates]=await Promise.all([sheet(ageBytes),sheet(rateBytes,'第５表')]);
  if(!ages.getCell('A1').text.normalize('NFKC').includes('令和7年国勢調査')||ages.getCell(6,34).text!=='平均年齢'||ages.getCell(10,34).text!=='歳'||ages.getCell(8,6).text!=='00_総数')throw new Error('平均年齢の表構造が変わりました');
  if(!rates.getCell(2,17).text.includes('2024')||!rates.getCell(3,17).text.includes('合計特殊')||rates.getCell(3,3).text.replace(/\s/g,'')!=='出生率')throw new Error('出生率の表構造が変わりました');
  const averageSource:Source={publisher:'総務省統計局',statistics:'令和7年国勢調査',table:'人口等基本集計 第50-1表 平均年齢',sourcePeriod:'2025-10',publishedAt:'2026-09-29',retrievedAt:new Date(now).toISOString(),url:REGIONAL_AGE_URL,status:'final',scope:'男女計の平均年齢。年齢不詳を除く。国籍総数には日本人・外国人の別が不詳の人を含む。'};
  const rateSource:Source={publisher:'厚生労働省',statistics:'人口動態統計',table:'2024年確定数 第5表 人口動態総覧（率）',sourcePeriod:'2024-12',publishedAt:'2025-09-16',retrievedAt:new Date(now).toISOString(),url:REGIONAL_RATE_URL,status:'final',scope:'日本人の統計。合計特殊出生率は15～49歳の女性の年齢別出生率を合計した期間指標。出生率（人口千対）は年間出生数を日本人人口で除し千倍した値。'};
  const averages:Record<string,Partial<Record<PopulationGroup,number>>>={};
  ages.eachRow(row=>{const code=row.getCell(3).text.match(/^(\d{2})000_/)?.[1];if(!code||!regions[code]||row.getCell(4).text!=='0_総数')return;
    const group=({'0_総数':'total','1_外国人':'foreign','2_日本人':'japanese'} as const)[row.getCell(5).text as '0_総数'];if(!group)return;
    if(regions[code].populationSource.sourcePeriod!==averageSource.sourcePeriod||row.getCell(6).value!==regions[code].rows.find(r=>r.group===group&&r.sex==='男女計'&&r.age==='総数')?.value)throw new Error('平均年齢と人口の基準・総数が一致しません');
    const record=averages[code]??={};if(record[group]!==undefined)throw new Error('平均年齢の地域が重複しています');record[group]=value(row.getCell(34),120);
  });
  const births:Record<string,{totalFertilityRate:number;crudeBirthRate:number}>={};
  rates.eachRow(row=>{const name=row.getCell(2).text.replace(/\s/g,'');const p=PREFECTURES.find(p=>p.name===name||p.name.replace(/[都府県]$/,'')===name);if(!p)return;if(births[p.code])throw new Error('出生率の地域が重複しています');births[p.code]={totalFertilityRate:value(row.getCell(17),10),crudeBirthRate:value(row.getCell(3),100)};});
  for(const p of PREFECTURES){const mean=averages[p.code];if(!regions[p.code]||!births[p.code]||!mean||populationGroups.some(g=>mean[g]===undefined))throw new Error('地域指標の47都道府県・国籍区分が不足しています');
    regions[p.code].indicators={averageAge:{values:mean as Record<PopulationGroup,number>,source:averageSource},birthRate:{...births[p.code],year:2024,source:rateSource}};
  }
}
export async function fetchRegionalIndicators(regions:Record<string,RegionalDetail>,now:number){const [age,rates]=await Promise.all([REGIONAL_AGE_URL,REGIONAL_RATE_URL].map(u=>download(new URL(u))));await addRegionalIndicators(regions,age,rates,now);}
