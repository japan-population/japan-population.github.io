import {RegionalYearSlider} from '../src/components/RegionalYearSlider';
import {beforeAll,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {normalizeRegionalTimeline,supplementRegionalNationalities,supplementRegionalForeignTotals,supplementRegionalVital,supplementRegionalIndicators} from '../scripts/sources/regional-timeline';
import {regionalTimelineSchema,type RegionalTimeline} from '../src/types/regional-timeline';
import {RegionalSnapshotDetail,RegionalSnapshotIndicators} from '../src/components/RegionalSnapshotDetail';
import type {Table} from '../scripts/sources/table';
let data:RegionalTimeline;
beforeAll(async()=>{
 data=await normalizeRegionalTimeline(await readFile('tests/fixtures/regional-history.xlsx'),await readFile('tests/fixtures/regional-projection.xlsx'),Date.UTC(2026,9,3));
 const tables=JSON.parse(await readFile('tests/fixtures/regional-timeline-tables.json','utf8')) as Record<string,Table>;
 supplementRegionalNationalities(data,tables);supplementRegionalForeignTotals(data,tables);supplementRegionalVital(data,tables);supplementRegionalIndicators(data,tables);
});
test('過去11年と公的将来推計3年は各47都道府県の原数値を保持',()=>{
 expect(Object.keys(data.past)).toHaveLength(11);expect(Object.keys(data.future)).toEqual(['2030','2040','2050']);
 expect(data.past[1920]['01'].groups.total?.population?.value).toBe(2359183);
 expect(data.past[2020]['13'].groups.total?.population?.value).toBe(14047594);
 expect(data.future[2050]['01'].groups.total?.population?.value).toBe(3820016);
 for(const records of [...Object.values(data.past),...Object.values(data.future)]){
  expect(Object.keys(records)).toHaveLength(47);
  for(const snapshot of Object.values(records))for(const [group,g]of Object.entries(snapshot.groups)){
   if(g.population){expect(g.male!.value+g.female!.value).toBe(g.population.value);expect(g.population.source.sourcePeriod).toBe(`${snapshot.year}-10`);}
   const keys=g.rows.map(r=>`${r.sex}/${r.age}`);expect(new Set(keys).size).toBe(keys.length);
   expect(g.rows.every(r=>r.group===group)).toBe(true);
   for(const sex of ['男女計','男','女']){const rows=g.rows.filter(r=>r.sex===sex&&r.age!=='総数');const total=g.rows.find(r=>r.sex===sex&&r.age==='総数');if(total)expect(rows.reduce((s,r)=>s+r.value,0)).toBeLessThanOrEqual(total.value+2);}
  }
 }
 expect(()=>regionalTimelineSchema.parse(data)).not.toThrow();
});
test('古い上位階級と沖縄の別階級を85–89歳などに偽装しない',()=>{
 const labels=(year:number,code:string)=>data.past[year][code].groups.total!.rows.map(r=>r.age);
 expect(labels(1920,'01')).toContain('80歳以上');expect(labels(1920,'01')).not.toContain('80～84歳');
 expect(labels(1950,'47')).toContain('70歳以上');
});
test('日本人との差引値と外国人の原数値を区別し年齢内訳は流用しない',()=>{
 const g=data.past[1990]['13'].groups;
 expect(g.japanese!.population!.value).toBe(g.total!.population!.value-g.foreign!.population!.value);
 expect(g.japanese!.population!.reference).toBe(true);expect(g.japanese!.rows.every(r=>r.age==='総数')).toBe(true);
 expect(data.past[2020]['13'].groups.foreign!.rows.length).toBeGreaterThan(3);
 expect(data.future[2030]['13'].groups.japanese).toBeUndefined();expect(data.future[2030]['13'].groups.foreign).toBeUndefined();
});
test('年次実績・出生率・面積の年は選択年に一致し外国人には日本人の動態を表示しない',()=>{
 const s=data.past[2010]['13'];expect(s.area?.value).toBe(2187.5);expect(s.groups.total?.fertilityRate?.value).toBe(1.12);
 for(const g of Object.values(s.groups))for(const event of Object.values(g.events??{}))expect(event.source.sourcePeriod).toBe('2010-12');
 expect(s.groups.foreign?.events).toBeUndefined();
 const $=load(renderToStaticMarkup(<RegionalSnapshotDetail snapshot={s} year={2010} group="foreign" name="東京都"/>));expect($('.stat-card .badge')).toHaveLength(0);expect($('.event-value').text()).not.toMatch(/\d/);
});
test('欠損年に最新値を表示せず全てデータなし、出典は一つの欄',()=>{
 const missing=load(renderToStaticMarkup(<RegionalSnapshotDetail year={2100} group="total" name="東京都"/>));expect(missing('.event-value').text()).toBe('データなし'.repeat(6));
 const s=data.past[2000]['13'];const $=load(renderToStaticMarkup(<RegionalSnapshotDetail snapshot={s} year={2000} group="total" name="東京都"/>));expect($('summary').filter((_,e)=>$(e).text().includes('データ基準'))).toHaveLength(1);
 const indicators=renderToStaticMarkup(<RegionalSnapshotIndicators snapshot={s} group="total"/>);expect(indicators).toContain('2000年');expect(indicators).not.toContain('2025年');expect(indicators.indexOf('移動による増減')).toBeLessThan(indicators.indexOf('自然増減'));
});

test('地域スライダーは過去・未来とも10年刻み、現在日付はスライダーの上',()=>{
 for(const [period,min,max,count]of [['past',1920,2020,11],['future',2030,2100,8]]as const){
  const $=load(renderToStaticMarkup(<RegionalYearSlider period={period} year={min} onChange={()=>{}}/>));
  expect($('input').attr('min')).toBe(String(min));expect($('input').attr('max')).toBe(String(max));expect($('input').attr('step')).toBe('10');
  expect($('.timeline-labels button')).toHaveLength(count);expect($('.official-date').next().is('input')).toBe(true);
 }
});
