import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {parseProjectionTable} from '../scripts/sources/projections';
import {projectionsSchema,PROJECTION_YEARS,PROJECTION_SCENARIOS} from '../src/types/projections';
import {futureYears,projectionView,projectionSources} from '../src/lib/projections';
import {FutureExplorer} from '../src/components/FutureExplorer';
import {readDataset} from '../scripts/dataset';
import {trendPaths} from '../src/lib/population-trend';
const data=(await readDataset('public/data')).national.projections!;
const now=Date.parse('2026-10-03T00:00:00+09:00');
it('公式Excelの単位を換算し、総数・男女・100歳以上・暦年の出生死亡を読む',async()=>{
 const total=await parseProjectionTable(await readFile('tests/fixtures/projection-totals.xlsx'),'1','medium','total');
 const ages=await parseProjectionTable(await readFile('tests/fixtures/projection-age.xlsx'),'9A','medium','total');
 const events=await parseProjectionTable(await readFile('tests/fixtures/projection-events.xlsx'),'8','medium','total');
 expect(total.counts.get(2070)).toEqual([86996009]);
 expect(ages.details.get(2070)).toMatchObject({population:86996009});
 expect(ages.details.get(2070)?.ages.at(-1)).toEqual([615199,121475,493724]);
 expect(events.counts.get(2021)).toEqual([831001,1445470]);
});
it('別シナリオ・別国籍・欠損セルを受け入れない',async()=>{
 const bytes=await readFile('tests/fixtures/projection-totals.xlsx');
 await expect(parseProjectionTable(bytes,'1','high','total')).rejects.toThrow('シナリオ');
 await expect(parseProjectionTable(bytes,'1','medium','japanese')).rejects.toThrow('対象');
 const b=new ExcelJS.Workbook();await b.xlsx.load(bytes as unknown as Parameters<typeof b.xlsx.load>[0]);b.worksheets[0].getCell('C15').value=null;
 await expect(parseProjectionTable(new Uint8Array(await b.xlsx.writeBuffer()),'1','medium','total')).rejects.toThrow('欠損');
});
it('3シナリオの2030〜2100年を毎年収録し、公的中位の既知値と一致する',()=>{
 expect(data.edition).toBe('2023');
 for(const s of PROJECTION_SCENARIOS){expect(data.scenarios[s].points.map(p=>p.year)).toEqual(Array.from({length:71},(_,i)=>2030+i));expect(Object.keys(data.scenarios[s].details).map(Number)).toEqual(PROJECTION_YEARS);expect(projectionSources(data,s).every(s=>s.status==='projection')).toBe(true);}
 expect(data.scenarios.medium.points.at(-1)?.population).toEqual({total:62778703,japanese:53064632});
 for(let i=0;i<71;i++)expect(data.scenarios.high.points[i].population.total).toBeGreaterThan(data.scenarios.medium.points[i].population.total);
 for(let i=0;i<71;i++)expect(data.scenarios.medium.points[i].population.total).toBeGreaterThan(data.scenarios.low.points[i].population.total);
});
it('外国人は同一シナリオの差分で、出生死亡と年齢構成も独自の増加率を足さない',()=>{
 for(const s of PROJECTION_SCENARIOS)for(const y of PROJECTION_YEARS){
  const t=projectionView(data,s,y,'total'),j=projectionView(data,s,y,'japanese'),f=projectionView(data,s,y,'foreign');
  for(const key of ['population','male','female','birth','death'] as const)expect(f[key]).toBe(t[key]-j[key]);
  f.rows.forEach((r,i)=>{expect(r.value).toBe(t.rows[i].value-j.rows[i].value);expect(r.value).toBeGreaterThanOrEqual(0);});
 }
 const f=projectionView(data,'medium',2100,'foreign');expect(f.population).toBe(9714071);expect(f.population/f.total*100).toBeCloseTo(15.47,2);
});
it('欠損年・異なる国籍の混入・ピラミッドの欠損を検出する',()=>{
 for(const mutate of [(d:typeof data)=>{d.scenarios.medium.points[0].year=2031;},(d:typeof data)=>{d.scenarios.medium.points[0].population.japanese=999999999;},(d:typeof data)=>{d.scenarios.low.details[2100].total.ages.pop();},(d:typeof data)=>{delete d.scenarios.high.details[2070];}]){const bad=structuredClone(data);mutate(bad);expect(()=>projectionsSchema.parse(bad)).toThrow();}
});
it('JSTで年が過ぎた選択肢を除き、2100年後はセクションを表示しない',()=>{
 expect(futureYears(now)).toEqual(PROJECTION_YEARS);
 expect(futureYears(Date.parse('2030-12-31T14:59:59.999Z'))[0]).toBe(2030);
 expect(futureYears(Date.parse('2030-12-31T15:00:00Z'))[0]).toBe(2040);
 expect(futureYears(Date.parse('2100-12-31T15:00:00Z'))).toEqual([]);
 expect(renderToStaticMarkup(<FutureExplorer data={data} now={Date.parse('2101-01-01T00:00:00+09:00')} group="total"/>)).toBe('');
});
it('過去確定値と同じ構造で、全対象共通の非固定グラフ・予測バッジを表示する',()=>{
 const charts=[];
 for(const group of ['total','japanese','foreign'] as const){const $=load(renderToStaticMarkup(<FutureExplorer data={data} now={now} group={group}/>));
  expect($('h2').text()).toContain('未来予測値');expect($('.official-controls .population-trend')).toHaveLength(0);expect($('.official-controls + .population-trend')).toHaveLength(1);
  expect($('.projection-switch button')).toHaveLength(3);expect($('.timeline-labels button')).toHaveLength(8);expect($('.official-pyramid[open]')).toHaveLength(0);expect($('.annual-vital[open]')).toHaveLength(0);
  expect($('.annual-vital .badge').text()).toBe('予測予測');expect($('#future').text()).not.toContain('国籍内訳');expect($('.source-details .badge').text()).not.toContain('公式確定値');charts.push($('.population-trend').html());
 }
 expect(new Set(charts).size).toBe(1);
});
it('将来横軸をスライダーに合わせ、単一年になっても0人基準で描画する',()=>{
 const points=data.scenarios.medium.points.map(p=>({date:`${p.year}-10-01`,total:p.population.total,japanese:p.population.japanese,foreign:p.population.total-p.population.japanese,precision:1 as const,sourceIndex:0}));
 const x=(date:string)=>((Number(date.slice(0,4))-2030)/10+.5)/8*100;
 const paths=trendPaths(points,x);expect(paths.line.split(' ').length).toBe(71);expect(paths.area).toContain(',220');expect(paths.line).not.toMatch(/NaN|Infinity/);
 expect(trendPaths([points.at(-1)!],()=>50).area).not.toMatch(/NaN|Infinity/);
});
