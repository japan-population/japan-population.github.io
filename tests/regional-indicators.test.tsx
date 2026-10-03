import {beforeAll,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import ExcelJS from 'exceljs';
import {addRegionalIndicators} from '../scripts/sources/regional-indicators';
import {RegionalIndicators} from '../src/components/RegionalIndicators';
import type {RegionalDetail} from '../src/types/statistics';
let regions:Record<string,RegionalDetail>,ages:Buffer,rates:Buffer;
beforeAll(async()=>{regions=JSON.parse(await readFile('public/data/region-details.json','utf8')).regions;ages=await readFile('tests/fixtures/regional-average-age-2025.xlsx');rates=await readFile('tests/fixtures/regional-rates-2024.xlsx');await addRegionalIndicators(regions,ages,rates,Date.parse('2026-10-03T00:00:00+09:00'));});
it('47県の3区分の平均年齢と2024年の確定出生率を収録する',()=>{expect(Object.keys(regions)).toHaveLength(47);const h=regions['01'].indicators!;expect(h.averageAge.values).toEqual({total:51.22486,japanese:51.48215,foreign:32.05392});expect(h.birthRate.totalFertilityRate).toBe(1.01);expect(h.birthRate.crudeBirthRate).toBe(4.5);expect(h.birthRate.year).toBe(2024);expect(regions['13'].indicators!.birthRate.totalFertilityRate).toBe(.96);});
it('人口の基準・総数の不一致を拒否する',async()=>{const copy=structuredClone(regions);copy['01'].populationSource.sourcePeriod='2020-10';await expect(addRegionalIndicators(copy,ages,rates,Date.now())).rejects.toThrow('基準・総数');});
it('出生率表に空欄があれば0扱いせず拒否する',async()=>{const b=new ExcelJS.Workbook();await b.xlsx.load(rates as never);b.getWorksheet('第５表')!.getCell(7,17).value=null;await expect(addRegionalIndicators(structuredClone(regions),ages,await b.xlsx.writeBuffer() as unknown as Uint8Array,Date.now())).rejects.toThrow('欠損');});
it('人口区分に従う平均年齢と小数2桁の出生率を表示し外国人に日本人の率を流用しない',()=>{const total=renderToStaticMarkup(<RegionalIndicators data={regions['01']} group="total"/>),foreign=renderToStaticMarkup(<RegionalIndicators data={regions['01']} group="foreign"/>);expect(total).toContain('51.2');expect(total).toContain('1.01');expect(total).toContain('日本人 · 2024年');expect(foreign).toContain('32.1');expect(foreign).toContain('データなし');expect(foreign).not.toContain('1.01');});

it('年間増減は日本人の自然増減と区分別の国内・国外住所移転から算出する',()=>{
 const h=regions['01'];const html=renderToStaticMarkup(<RegionalIndicators data={h} group="total"/>);
 expect(html).toContain('−53,083');expect(html).toContain('+2,244');expect(html.indexOf('平均年齢')).toBeLessThan(html.indexOf('自然増減'));expect(html.indexOf('移動による増減')).toBeLessThan(html.indexOf('自然増減'));expect(html.indexOf('自然増減')).toBeLessThan(html.indexOf('合計特殊出生率'));
 const foreign=renderToStaticMarkup(<RegionalIndicators data={h} group="foreign"/>);expect(foreign).not.toContain('−53,083');expect(foreign).toContain('+7,175');expect(foreign).toContain('データなし');
});
