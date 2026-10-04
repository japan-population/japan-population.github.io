import {test,expect} from 'vitest';
import ExcelJS from 'exceljs';
import {readFile} from 'node:fs/promises';
import {readTamaFertility,addTamaFertility,approximateTamaFertility} from '../scripts/sources/tokyo-fertility';
import {emptyAreas} from '../scripts/sources/tokyo-areas';
import {tokyoAreasSchema} from '../src/types/tokyo-areas';

async function sheet(rows:unknown[][]){
 const book=new ExcelJS.Workbook(),s=book.addWorksheet('付表');s.addRows(rows);
 return new Uint8Array(await book.xlsx.writeBuffer());
}
test('市部・郡部の率を足さず、多摩の公表集計だけを取得する',async()=>{
 const bytes=await sheet([['地域','合計特殊\n出生率'],['市部',1.04],['郡部',.94],['多摩','1.03']]);
 expect(await readTamaFertility(bytes)).toBe(1.03);
});
test('多摩行の欠落・重複・不正な値は公開前に検出する',async()=>{
 for(const rows of [ [['市部',1.04],['郡部',.94]], [['多摩',1.03],['市郡部',1.03]], [['多摩','-']], [['多摩','']], [['多摩',-1]] ]){
   await expect(readTamaFertility(await sheet([['地域','合計特殊出生率'],...rows]))).rejects.toThrow();
 }
});
test('2020年・最新の公表値を表示し、日本人の率を外国人へ適用しない',async()=>{
 const d=tokyoAreasSchema.parse(JSON.parse(await readFile('public/data/tokyo-areas.json','utf8')));
 const known=[[d.past[2020],1.18,'2020']]as const;
 for(const [areas,value,year]of known){
   const metric=areas.tama.groups.total!.fertilityRate!;
   expect(metric.value).toBe(value);expect(metric.source.sourcePeriod).toBe(`${year}-12`);
   expect(areas.tama.groups.japanese!.fertilityRate).toEqual(metric);
   expect(areas.tama.groups.foreign?.fertilityRate).toBeUndefined();
 }
 const latest=d.latest.tama.groups.total!.fertilityRate!;
 expect(Number.isFinite(latest.value)).toBe(true);
 if(latest.source.sourcePeriod==='2024-12')expect(latest.value).toBe(1.03);
 expect(d.latest.tama.groups.japanese!.fertilityRate).toEqual(latest);
 expect(d.latest.tama.groups.foreign?.fertilityRate).toBeUndefined();
 const areas=emptyAreas(2024),source=d.latest.tama.groups.total!.fertilityRate!.source;
 addTamaFertility(areas,0,source);expect(areas.tama.groups.total!.fertilityRate!.value).toBe(0);
 expect(()=>addTamaFertility(areas,NaN,source)).toThrow();
});
test('2000・2010年は女性人口で加重した参考値と明示し、他年・外国人へ流用しない',async()=>{
 const d=tokyoAreasSchema.parse(JSON.parse(await readFile('public/data/tokyo-areas.json','utf8')));
 for(const [year,city,county,cw,gw]of [[2000,1.18,1.23,917745,12658],[2010,1.24,1.19,909999,10987]]){
   const value=approximateTamaFertility(city,county,cw,gw),metric=d.past[year].tama.groups.total!.fertilityRate!;
   expect(metric.value).toBeCloseTo(value,10);expect(metric.reference).toBe(true);
   expect(metric.source.scope).toContain('厳密な合計特殊出生率とは一致しない');
   expect(metric.source.sourcePeriod).toBe(`${year}-12`);
   expect(d.past[year].tama.groups.foreign?.fertilityRate).toBeUndefined();
 }
 expect(approximateTamaFertility(0,0,10,20)).toBe(0);
 expect(()=>approximateTamaFertility(1,2,0,20)).toThrow();
 expect(()=>approximateTamaFertility(1,2,Infinity,20)).toThrow();
 expect(()=>approximateTamaFertility(NaN,2,10,20)).toThrow();
});
