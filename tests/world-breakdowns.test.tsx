import {loadWorldBreakdowns,worldBreakdownSections} from '../src/components/WorldEventBreakdown';
import {readFileSync,readdirSync} from 'node:fs';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {eventBreakdownsSchema} from '../src/types/statistics';
import {breakdownCount} from '../src/lib/event-breakdowns';
import {EventBreakdown} from '../src/components/EventBreakdown';
import {WorldSection} from '../src/components/WorldSection';
const read=(year:number)=>eventBreakdownsSchema.parse(JSON.parse(readFileSync(`public/world-breakdowns/${year}.json`,'utf8')));
describe('world demographic breakdowns',()=>{
 it('validates every year and reconciles each distribution without overlapping regional aggregates',()=>{
  const files=readdirSync('public/world-breakdowns').filter(f=>f.endsWith('.json'));
  expect(files).toHaveLength(77);
  for(const file of files){
   const year=Number(file.slice(0,4)),sections=read(year);
   expect(sections.map(s=>s.kind)).toEqual(['birthCountry','motherAge','cause','deathAge']);
   for(const section of sections){
    expect(section.items.reduce((sum,i)=>sum+i.count,0)).toBe(section.total);
    expect(section.items.reduce((sum,i)=>sum+breakdownCount(section,i.count,12345).percent,0)).toBeCloseTo(100,8);
    expect(section.year).toBe(section.kind==='cause'?2023:year);
   }
   expect(sections[0].items).toHaveLength(237);
   expect(sections[1].items).toHaveLength(9);
   expect(sections[3].items).toHaveLength(21);
  }
 });
 it('keeps source counts, descending birth countries and WHO reference-year provenance',()=>{
  const [country,mother,cause,death]=read(2026);
  expect(country.items[0].label).toBe('インド');
  expect(country.items.every((v,i)=>i===0||v.count<=country.items[i-1].count)).toBe(true);
  expect(mother.items[0]).toEqual({label:'10～14歳',count:317560});
  expect(death.items.at(-1)).toEqual({label:'100歳以上',count:284802});
  expect(cause.total).toBe(61071367);
  expect(cause.items[0]).toEqual({label:'虚血性心疾患',count:9469357,rank:1});
  expect(cause.source.status).toBe('reference');expect(cause.source.sourcePeriod).toBe('2023-12');
 });
 it('scales every category by the same live total and handles zero',()=>{
  for(const section of read(2026))for(const item of section.items){
   expect(breakdownCount(section,item.count,0).count).toBe(0);
   const first=breakdownCount(section,item.count,100000),next=breakdownCount(section,item.count,200000);
   expect(next.count).toBeGreaterThanOrEqual(first.count);
   expect(next.percent).toBe(first.percent);
  }
 });
 it('initially shows four closed accordions with no large hidden tables',()=>{
  const $=load(renderToStaticMarkup(<WorldSection now={Date.parse('2026-10-11T12:00:00+09:00')}/>));
  expect($('.world-breakdown summary').map((_,el)=>$(el).text()).get()).toEqual(['出生国','出産年齢（母）','死因','死亡年齢']);
  expect($('.world-breakdown details[open]')).toHaveLength(0);
  expect($('.world-breakdown table')).toHaveLength(0);
 });

 it('shows the top ten birth countries with ranks and preserves world shares',()=>{
  const raw=read(2026),sections=worldBreakdownSections(raw,'birth');
  expect(sections[0].items).toHaveLength(10);
  expect(sections[0].total).toBe(raw[0].total);
  expect(sections[0].items.map(i=>i.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  expect(raw[0].items).toHaveLength(237);
  expect(sections[0].items.reduce((n,i)=>n+breakdownCount(sections[0],i.count,100000).percent,0)).toBeLessThan(100);
  const $=load(renderToStaticMarkup(<EventBreakdown event="birth" sections={sections} total={100000} kinds={['birthCountry','motherAge']}/>));
  expect($('tbody').first().find('tr')).toHaveLength(10);
  expect($('.breakdown-rank').map((_,el)=>$(el).text()).get()).toEqual(['1','2','3','4','5','6','7','8','9','10']);
 });
 it('uses the shared table UI and omits traffic accidents and other causes',()=>{
  const sections=worldBreakdownSections(read(2026),'death');
  const $=load(renderToStaticMarkup(<EventBreakdown event="death" sections={sections} total={100000} kinds={['cause','deathAge']} includeCauseSupplements={false}/>));
  expect($('.breakdown-category')).toHaveLength(2);expect($('.source-details')).toHaveLength(1);
  expect($('tbody').first().find('tr')).toHaveLength(12);
  expect($('tbody').first().text()).toContain('他殺');
  expect($('tbody').first().text()).not.toContain('道路交通事故');
  expect($('tbody').first().find('th').map((_,el)=>$(el).text()).get()).not.toContain('その他');
 });
});

describe('world breakdown lazy loading',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('shares one static JSON request between the two cards',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>read(2027)});
  vi.stubGlobal('fetch',fetcher);
  const first=loadWorldBreakdowns(2027),second=loadWorldBreakdowns(2027);
  expect(first).toBe(second);await first;
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain('world-breakdowns/2027.json');
 });
 it('allows retry after a failed request and avoids requests for unsupported years',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>read(2028)});
  vi.stubGlobal('fetch',fetcher);
  await expect(loadWorldBreakdowns(2028)).rejects.toThrow();
  expect(await loadWorldBreakdowns(2028)).toHaveLength(4);
  expect(await loadWorldBreakdowns(2101)).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
