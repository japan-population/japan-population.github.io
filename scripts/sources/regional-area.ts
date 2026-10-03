import ExcelJS from 'exceljs';
import {PREFECTURES} from '../../src/lib/prefectures';
import type {RegionalDetail} from '../../src/types/statistics';
import {download} from './http';
export const REGIONAL_AREA_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040506423&fileKind=0';
export async function addRegionalArea(regions:Record<string,RegionalDetail>,bytes:Uint8Array,now:number){
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);const s=book.worksheets[0];
 if(!s.getCell('A1').text.normalize('NFKC').includes('令和7年国勢調査')||s.getCell(10,15).text!=='面積（参考）'||s.getCell(10,16).text!=='人口密度'||s.getCell(14,15).text!=='km2')throw new Error('面積・人口密度の表構造が変わりました');
 const seen=new Set<string>();
 s.eachRow(row=>{const area=row.getCell(6).text;if(row.getCell(1).text!=='a'||!/^\d{2}000$/.test(area))return;const code=area.slice(0,2);if(!regions[code])return;if(seen.has(code))throw new Error('面積の地域が重複しています');seen.add(code);
  const region=regions[code];if(region.populationSource.sourcePeriod!=='2025-10'||row.getCell(8).value!==region.rows.find(r=>r.group==='total'&&r.sex==='男女計'&&r.age==='総数')?.value)throw new Error('面積表と地域人口の基準が不一致です');
  const areaKm2=row.getCell(15).value,populationDensity=row.getCell(16).value;
  if(typeof areaKm2!=='number'||!Number.isFinite(areaKm2)||areaKm2<=0||typeof populationDensity!=='number'||!Number.isFinite(populationDensity)||populationDensity<=0)throw new Error('面積・人口密度に不正な値があります');
  region.geography={areaKm2,populationDensity,source:{...region.populationSource,table:'人口等基本集計 第1-1表 面積（参考）・人口密度',url:REGIONAL_AREA_URL,retrievedAt:new Date(now).toISOString(),scope:'面積は国土地理院の2025年10月1日現在の面積調による参考値。人口密度は総人口に対する公表値で、国勢調査対象外地域の面積を除いて算出。人口区分を切り替えても面積・人口密度は共通。'}};
 });
 if(PREFECTURES.some(p=>!seen.has(p.code)))throw new Error('面積・人口密度の都道府県が不足しています');
}
export async function fetchRegionalArea(regions:Record<string,RegionalDetail>,now:number){await addRegionalArea(regions,await download(new URL(REGIONAL_AREA_URL)),now);}
