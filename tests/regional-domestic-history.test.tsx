import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {renderToStaticMarkup} from 'react-dom/server';
import {supplementDomesticMigrationHistory} from '../scripts/sources/regional-domestic-history';
import {availableRegionalPastYears} from '../src/lib/regional-view';
import {RegionalSnapshotIndicators} from '../src/components/RegionalSnapshotDetail';
import {RegionalYearSlider} from '../src/components/RegionalYearSlider';
import type {RegionalTimeline} from '../src/types/regional-timeline';

async function timeline(){
 const past:RegionalTimeline['past']={};
 for(let y=1920;y<=2020;y+=10)past[y]=JSON.parse(await readFile(`public/data/regional/past-${y}.json`,'utf8')).regions;
 return {past,future:{}};
}
test('単年国内移動を全対象県に収録し転入超過の合計はゼロ、対象外をゼロで埋めない',async()=>{
 const t=await timeline();supplementDomesticMigrationHistory(t);
 for(const year of [1960,1970,1980,1990,2000,2010]){
  const observations=Object.values(t.past[year]).filter(r=>r.groups.total?.migrationChange?.migrationCoverage==='domestic-japanese');
  expect(observations).toHaveLength(year<1980?46:47);
  expect(observations.reduce((sum,r)=>sum+r.groups.total!.migrationChange!.value,0)).toBe(0);
  for(const r of observations){
   const g=r.groups.total!,j=r.groups.japanese!;
   expect(g.migrationChange!.value).toBe(g.events!.inflow!.value-g.events!.outflow!.value);
   expect(j.migrationChange!.value).toBe(g.migrationChange!.value);
   expect(g.migrationChange!.calculation).toBeUndefined();expect(r.groups.foreign?.migrationChange).toBeUndefined();
  }
 }
 for(const [year,value]of [[1970,-104563],[1980,-94889],[1990,-51076]])expect(t.past[year]['13'].groups.total!.migrationChange!.value).toBe(value);
 expect(t.past[1980]['31'].groups.total!.migrationChange!.value).toBe(316);
 for(const year of [1920,1930,1940,1950])expect(t.past[year]['13'].groups.total!.migrationChange!.estimateKind).toBe('residual');
 for(const year of [1960,1970])expect(t.past[year]['47'].groups.total!.migrationChange!.estimateKind).toBe('residual');
 const $=load(renderToStaticMarkup(<RegionalSnapshotIndicators snapshot={t.past[1980]['31']} group="total"/>));
 expect($('.regional-migration-change').text()).toContain('国内・日本人 · 1980年');expect($('.regional-migration-change strong').text()).toBe('+316人');
});
test('人口のない日本人1950～1970年は補助指標があっても選択不可',async()=>{
 const t=await timeline();
 for(const year of [1950,1960,1970])expect(t.past[year]['13'].groups.japanese?.events).toBeDefined();
 for(const group of ['japanese','foreign']as const){
  const years=availableRegionalPastYears(t.past,group);
  expect(years).toEqual([1980,1990,2000,2010,2020]);
  const $=load(renderToStaticMarkup(<RegionalYearSlider period="past" year={1980} availableYears={years} onChange={()=>{}}/>));
  for(const year of [1950,1960,1970])expect($('.timeline-labels button').filter((_,el)=>$(el).text()===String(year)).attr('disabled')).toBeDefined();
 }
 expect(availableRegionalPastYears(t.past,'total')).toHaveLength(11);
});
