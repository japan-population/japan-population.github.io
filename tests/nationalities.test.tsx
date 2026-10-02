import { expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeCensusNationalities } from '../scripts/sources/census-regions';
import { PopulationExplorer } from '../src/components/PopulationExplorer';
import { fixture } from '../scripts/build-fixture';
const now=Date.parse('2026-10-02T00:00:00+09:00');
it('国籍の末端分類を合算し、大陸小計と日本人・外国人不詳を混入させない',async()=>{
 const data=await normalizeCensusNationalities(await readFile('tests/fixtures/census-2025-regions.xlsx'),now);
 expect(data.total).toBe(3461758);expect(data.populationTotal).toBeGreaterThan(data.total);expect(data.items).toHaveLength(45);
 expect(data.items.find(i=>i.name==='中国')?.value).toBe(816654);
 expect(data.items.find(i=>i.code==='17')?.value).toBe(142560);
 expect(data.items.reduce((n,i)=>n+i.value,0)).toBe(data.total);
 expect(data.items.some(i=>i.code==='11'||i.code==='3')).toBe(false);
 expect(new Set(data.items.map(i=>i.name)).size).toBe(45);
});
it('国籍列の欠損を0にせず更新を止める',async()=>{
 const b=new ExcelJS.Workbook();await b.xlsx.readFile('tests/fixtures/census-2025-regions.xlsx');
 b.worksheets[0].getCell(11,17).value=null;
 await expect(normalizeCensusNationalities(await b.xlsx.writeBuffer() as unknown as Uint8Array,now)).rejects.toThrow('不正');
});
it('過去確定値の外国人表示にのみ国籍内訳と独立した基準日を表示',async()=>{
 const n=fixture(now).national;n.nationalities=await normalizeCensusNationalities(await readFile('tests/fixtures/census-2025-regions.xlsx'),now);
 for(const group of ['total','japanese','foreign'] as const){
  const html=renderToStaticMarkup(<PopulationExplorer national={n} group={group} demo={false}/>);
  expect(html).toContain('過去確定値');
  expect(html.includes('aria-label="外国人の国籍内訳"')).toBe(group==='foreign');
  if(group==='foreign'){expect(html).toContain('2025年10月');expect(html).toContain('816,654');expect(html).toContain('aria-label="総人口に占める割合">2.8%</small>');expect(html).toContain('すべての国籍内訳を見る');}
 }
});

it('外国人人口の横に同じ基準日の総人口に対する割合を小数点1桁で表示する',()=>{
 const n=fixture(now).national;
 n.breakdown!.groups.total.base=100000000;n.breakdown!.groups.foreign.base=3456789;
 const render=(group:'total'|'japanese'|'foreign')=>renderToStaticMarkup(<PopulationExplorer national={n} group={group} demo={false}/>);
 expect(render('foreign')).toContain('aria-label="総人口に占める割合">3.5%</small>');
 expect(render('total')).not.toContain('総人口に占める割合');
 expect(render('japanese')).not.toContain('総人口に占める割合');
 n.breakdown!.groups.total.baseDate='2025-10-01T00:00:00+09:00';
 expect(render('foreign')).not.toContain('総人口に占める割合');
 n.breakdown!.groups.total.baseDate=n.breakdown!.groups.foreign.baseDate;
 n.breakdown!.groups.total.base=0;
 expect(render('foreign')).not.toContain('総人口に占める割合');
});
