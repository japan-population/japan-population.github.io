import {beforeAll,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {normalizeRegionalTimeline,supplementRegionalIndicators} from '../scripts/sources/regional-timeline';
import {supplementRegionalMigration} from '../scripts/sources/regional-migration-history';
import {correctRegionalTerritories} from '../scripts/sources/regional-territories';
import {allocateRegional,extendRegionalProjections} from '../scripts/models/regional-projection';
import {RegionalYearSlider} from '../src/components/RegionalYearSlider';
import {regionalTimelineSchema,type RegionalTimeline} from '../src/types/regional-timeline';
import type {National,RegionalDetail} from '../src/types/statistics';
let raw:RegionalTimeline;
beforeAll(async()=>{raw=await normalizeRegionalTimeline(await readFile('tests/fixtures/regional-history.xlsx'),await readFile('tests/fixtures/regional-projection.xlsx'),0);supplementRegionalIndicators(raw,JSON.parse(await readFile('tests/fixtures/regional-timeline-tables.json','utf8')));});
test('2020年の転入出は国内県間と国外だけを合計し3国籍区分の全国合計と一致',async()=>{
 const t=structuredClone(raw);await supplementRegionalMigration(t,await readFile('tests/fixtures/regional-domestic-2020.xlsx'),await readFile('tests/fixtures/regional-international-2020.xlsx'),0);
 const h=t.past[2020]['01'].groups.total!;expect(h.events!.inflow!.value).toBe(51845+6294);expect(h.events!.outflow!.value).toBe(53161+7362);expect(h.migrationChange!.value).toBe(-2384);
 const sum=(field:'inflow'|'outflow')=>Object.values(t.past[2020]).reduce((s,r)=>s+r.groups.total!.events![field]!.value,0);
 expect(sum('inflow')).toBe(2463992+358359);expect(sum('outflow')).toBe(2463992+226845);
 for(const r of Object.values(t.past[2020]))for(const field of ['inflow','outflow']as const)expect(r.groups.total!.events![field]!.value).toBe(r.groups.japanese!.events![field]!.value+r.groups.foreign!.events![field]!.value);
 expect(t.past[2010]['13'].groups.total?.migrationChange).toBeUndefined();
});
test('奄美を一度だけ鹿児島へ移し、総人口・男女・面積・調査日を揃える',()=>{
 const t=structuredClone(raw);correctRegionalTerritories(t,0);const r=t.past[1950];
 expect(r['47'].groups.total!.population!.value).toBe(698827);expect(r['46'].groups.total!.population!.value).toBe(2020228);
 expect(r['47'].groups.total!.male!.value).toBe(328908);expect(r['47'].groups.total!.female!.value).toBe(369919);
 expect(Object.values(r).reduce((s,v)=>s+v.groups.total!.population!.value,0)).toBe(84114574);
 expect(r['47'].area!.value).toBe(2388.22);expect(r['47'].area!.value+r['46'].area!.value).toBeCloseTo(raw.past[1950]['47'].area!.value+raw.past[1950]['46'].area!.value,6);
 expect(r['47'].groups.total!.population!.source.sourcePeriod).toBe('1950-12');expect(t.past[1960]['47'].groups.total!.population!.source.sourcePeriod).toBe('1960-12');
 expect(r['13'].groups.total!.population!.value).toBe(6277500);expect(r['13'].groups.total!.population!.source.scope).toContain('伊豆諸島は東京都');
 expect(r['47'].groups.total!.rows.every(row=>row.age==='総数')).toBe(true);
 expect(()=>correctRegionalTerritories(t,0)).toThrow('二重補正');
});
test('2060年以降は全国の男女別総数を保った参考配分で最新面積を全将来年に保持',async()=>{
 const n=JSON.parse(await readFile('public/data/national.json','utf8')) as National;
 const details=JSON.parse(await readFile('public/data/region-details.json','utf8')).regions as Record<string,RegionalDetail>;
 const t=structuredClone(raw),official=JSON.stringify(t.future[2050]['13'].groups.total);extendRegionalProjections(t,n.projections!,details,0);
 expect(JSON.stringify(t.future[2050]['13'].groups.total)).toBe(official);
 for(const year of [2060,2070,2080,2090,2100]){
  const records=Object.values(t.future[year]),national=n.projections!.scenarios.medium.details[year].total;expect(records).toHaveLength(47);
  for(const key of ['population','male','female']as const)expect(records.reduce((s,r)=>s+r.groups.total![key]!.value,0)).toBe(national[key]);
  for(const r of records){expect(r.status).toBe('reference');expect(r.groups.japanese).toBeUndefined();expect(r.groups.foreign).toBeUndefined();for(const sex of ['男','女','男女計']){const rows=r.groups.total!.rows.filter(x=>x.sex===sex);expect(rows.filter(x=>x.age!=='総数').reduce((s,x)=>s+x.value,0)).toBe(rows.find(x=>x.age==='総数')!.value);}}
 }
 for(const records of Object.values(t.future))for(const [code,r]of Object.entries(records)){expect(r.area!.value).toBe(details[code].geography!.areaKm2);expect(r.area!.source.sourcePeriod).toBe('2025-10');expect(r.density!.value).toBeGreaterThan(0);}
 expect(()=>regionalTimelineSchema.parse(t)).not.toThrow();expect(allocateRegional(7,[1,1,1])).toEqual([3,2,2]);expect(()=>allocateRegional(5,[0,0])).toThrow();
});
test('データなし年は灰色対象のdisabledになり、沖縄の調査日は12月表示',()=>{
 const $=load(renderToStaticMarkup(<RegionalYearSlider period="past" year={1980} availableYears={[1980,1990,2000,2010,2020]} onChange={()=>{}}/>));
 expect($('.timeline-labels button:disabled')).toHaveLength(6);expect($('.timeline-labels button[aria-pressed=true]').text()).toBe('1980');
 const date=renderToStaticMarkup(<RegionalYearSlider period="past" year={1950} date="1950-12" onChange={()=>{}}/>);expect(date).toContain('1950年12月1日現在');
});
