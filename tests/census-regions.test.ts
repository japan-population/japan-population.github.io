import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {normalizeCensusRegions} from '../scripts/sources/census-regions';
const file='tests/fixtures/census-2025-regions.xlsx',now=Date.parse('2026-10-02T00:00:00+09:00');
it('47県の確定人口を原数値から抽出し、国籍不詳を外国人に含めない',async()=>{
 const r=await normalizeCensusRegions(await readFile(file),now);
 expect(Object.keys(r)).toHaveLength(47);expect(r['13'].total.value).toBe(14236627);expect(r['13'].japanese.value).toBe(13166391);expect(r['13'].foreign.value).toBe(692864);
 expect(r['13'].total.value-r['13'].japanese.value-r['13'].foreign.value).toBe(377372);
 expect(r['13'].total.source.sourcePeriod).toBe('2025-10');expect(r['13'].total.source.publishedAt).toBe('2026-09-29');
});
it('列構造変更と欠損県を拒否',async()=>{
 const b=new ExcelJS.Workbook();await b.xlsx.readFile(file);b.worksheets[0].getCell('E7').value='別項目';
 await expect(normalizeCensusRegions(new Uint8Array(await b.xlsx.writeBuffer()),now)).rejects.toThrow('列');
 await b.xlsx.readFile(file);b.worksheets[0].spliceRows(12,1);
 await expect(normalizeCensusRegions(new Uint8Array(await b.xlsx.writeBuffer()),now)).rejects.toThrow('47');
});
