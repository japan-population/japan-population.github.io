import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {load} from 'cheerio';
import {renderToStaticMarkup} from 'react-dom/server';
import ExcelJS from 'exceljs';
import {normalizeAnnualPopulation,mergePopulationTrend,trendSource,fillHistoricalBreakdown} from '../scripts/sources/population-trend';
import {readDataset} from '../scripts/dataset';
import {populationTrendSchema} from '../src/types/statistics';
import {trendX,trendY,trendPaths,nearestTimelineIndex} from '../src/lib/population-trend';
import {PopulationExplorer} from '../src/components/PopulationExplorer';
import {PopulationTrendChart} from '../src/components/PopulationTrendChart';
const bytes=await Promise.all(['old','new','reference'].map(n=>readFile(`tests/fixtures/annual-population-${n}.xlsx`)));
const tables=await Promise.all(bytes.map((b,i)=>normalizeAnnualPopulation(b,i,i===2)));
const {national}=await readDataset('public/data');
const data=national.populationTrend!;
it('最新参考表の年次欄から月次収録期間より前の確定値も取得する',async()=>{
 const annual=await normalizeAnnualPopulation(await readFile('tests/fixtures/annual-population-latest.xlsx'),3,true);
 expect(annual).toHaveLength(10);
 expect(annual[0]).toMatchObject({date:'2016-10-01',total:127041812,precision:1});
 expect(annual.at(-1)).toMatchObject({date:'2025-10-01',total:123219024,japanese:119379692,foreign:3839332});
});
it('各年の公表値を使い戦中や内訳欠損を補間しない',()=>{
 expect(tables[0]).toHaveLength(81);
 expect(tables[0].find(p=>p.date.startsWith('1940'))).toMatchObject({total:71933000,precision:1000});
 expect(tables[0].find(p=>p.date.startsWith('1945'))).toMatchObject({date:'1945-11-01',total:72147000});
 expect(tables[0].find(p=>p.date.startsWith('1949'))?.japanese).toBeUndefined();
 expect(tables[0].find(p=>p.date.startsWith('1950'))).toMatchObject({total:83200000,japanese:82672000,foreign:528000});
 expect(tables[2].find(p=>p.date.startsWith('2021'))).toMatchObject({total:125502290,japanese:122780487,foreign:2721803,precision:1});
 expect(data.points.map(p=>Number(p.date.slice(0,4)))).toEqual(Array.from({length:107},(_,i)=>1920+i));
 expect(data.points.at(-1)).toMatchObject({date:national.population.baseDate.slice(0,10),total:national.population.base});
});
it('新しい公表値を優先し毎年の連続性と内訳合計を検証する',()=>{
 const latest=national.breakdown!.groups;
 const exact=Object.fromEntries(Object.entries(latest).map(([g,p])=>[g,[{month:p.source.sourcePeriod,value:p.base,source:p.source}]]));
 // Keep the already verified intervening annual records in the input.
 const merged=mergePopulationTrend([...tables,data.points.filter(p=>p.date>'2023-12-31'&&p.date<'2026-01-01')],[...data.sources],exact as Parameters<typeof mergePopulationTrend>[2]);
 expect(merged.points.at(-1)?.total).toBe(latest.total.base);
 expect(merged.points.find(p=>p.date==='2015-10-01')?.total).toBe(127094745);
 for(const mutate of [(d:typeof data)=>d.points.splice(5,1),(d:typeof data)=>{d.points[50].foreign!++;},(d:typeof data)=>{d.points[10].sourceIndex=999;}]){
  const bad=structuredClone(data);mutate(bad);expect(()=>populationTrendSchema.parse(bad)).toThrow();
 }
});
it('公式表の単位や必須列の欠損を拒否する',async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes[0] as unknown as Parameters<typeof book.xlsx.load>[0]);
 book.worksheets[0].getCell('D42').value=null;
 await expect(normalizeAnnualPopulation(new Uint8Array(await book.xlsx.writeBuffer()),0)).rejects.toThrow('年次総人口');
});
it('スライダーの12位置に横軸を合わせ、年次の点と0人基準を維持する',()=>{
 for(let i=1;i<11;i++)expect(trendX(`${1920+i*10}-10-01`,data.points.at(-1)!.date)-trendX(`${1910+i*10}-10-01`,data.points.at(-1)!.date)).toBeCloseTo(trendX('1930-10-01',data.points.at(-1)!.date)-trendX('1920-10-01',data.points.at(-1)!.date));
 expect(trendX(data.points.at(-1)!.date,data.points.at(-1)!.date)).toBeCloseTo(11.5/12*100);
 expect(trendX('1921-10-01',data.points.at(-1)!.date)-trendX('1920-10-01',data.points.at(-1)!.date)).toBeCloseTo((100*11/12)/105.5);
 expect((trendX('2026-04-01','2026-04-01')-trendX('2020-10-01','2026-04-01'))/(trendX('2020-10-01','2026-04-01')-trendX('2010-10-01','2026-04-01'))).toBeCloseTo(.55);
 expect(nearestTimelineIndex([0,120,240,1266],220)).toBe(2);
 const paths=trendPaths(data.points);expect(trendY(0,paths.maximum)).toBe(220);
 expect(paths.line.match(/[ML]/g)).toHaveLength(107);
 expect(paths.area.endsWith('Z')).toBe(true);expect(paths.line).not.toMatch(/NaN|Infinity/);
 const $=load(renderToStaticMarkup(<PopulationTrendChart data={data} selection={1940}/>));
 expect($('.trend-y-label').first().text()).toBe('0人');expect($('.trend-year-tick')).toHaveLength(107);
});
it('総人口・日本人・外国人で同じグラフを表示し固定エリアから外す',()=>{
 const htmls=['total','japanese','foreign'].map(group=>{
  const $=load(renderToStaticMarkup(<PopulationExplorer national={national} group={group as 'total'|'japanese'|'foreign'} demo={false}/>));
  expect($('.section-controls .population-trend')).toHaveLength(0);
  expect($('.section-controls').next().hasClass('population-trend')).toBe(true);
  return $('.population-trend').html();
 });
 expect(new Set(htmls).size).toBe(1);
});

it('未収録の国籍別内訳だけを参考値で補い、総人口と公表済み内訳を維持する',()=>{
 const raw=structuredClone(data);
 for(const p of raw.points)if(p.breakdownReference){delete p.japanese;delete p.foreign;delete p.breakdownReference;}
 const filled=fillHistoricalBreakdown(raw,national.archive!);
 expect(filled.points.every(p=>p.japanese!==undefined&&p.foreign!==undefined)).toBe(true);
 expect(filled.points.map(p=>p.total)).toEqual(raw.points.map(p=>p.total));
 expect(filled.points[0]).toMatchObject({foreign:78061,breakdownReference:{method:'census-reference'}});
 expect(filled.points[5].breakdownReference).toMatchObject({method:'linear-interpolation',anchorDates:['1920-10-01','1930-10-01']});
 expect(filled.points[5].foreign).toBeGreaterThan(78061);expect(filled.points[5].foreign).toBeLessThan(477980);
 expect(filled.points.filter(p=>p.date>='1950')).toEqual(raw.points.filter(p=>p.date>='1950'));
 for(const p of filled.points)expect(p.japanese!+p.foreign!).toBe(p.total);
 expect(fillHistoricalBreakdown(filled,national.archive!)).toEqual(filled);
 const html=renderToStaticMarkup(<PopulationTrendChart data={filled} selection={1920}/>);
 expect(html).not.toContain('内訳未収録');expect(html).toContain('参考値');
 const $=load(html);expect($('.trend-japanese-area')).toHaveLength(1);expect($('.trend-foreign-area')).toHaveLength(1);
 const bad=structuredClone(filled);bad.points[0].breakdownReference!.sourceIndexes=[999];expect(()=>populationTrendSchema.parse(bad)).toThrow();
});
