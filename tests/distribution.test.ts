import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { normalizeWeights } from '../src/lib/distribution/weights';
import { eventProfiles,defaultDistribution } from '../src/lib/distribution/profiles';
import { allocateAnnualTarget,buildCalendarPlan,readCalendarPlan,dayCharacteristics } from '../src/lib/distribution/engine';
import { prepareSeriesPlan,readSeriesPlan } from '../src/lib/distribution/series';
import { distributionKinds } from '../src/types/distribution';
import { monthStart,addMonths,secondsInMonth } from '../src/lib/time';
import { fixture } from '../scripts/build-fixture';
import { nationalIndicators } from '../src/lib/groups';
import { normalizeHolidays,normalizeBirthDistribution } from '../scripts/sources/distribution';
import { groupEvents, internationalEvents } from '../scripts/models/group-events';
const profiles=eventProfiles(),calendar=defaultDistribution.calendar;
const targets=Object.fromEntries(Array.from({length:12},(_,i)=>[`2026-${String(i+1).padStart(2,'0')}`,10000.123+i*500]));
const total=Object.values(targets).reduce((a,b)=>a+b,0);
const at=(date:string)=>Date.parse(`${date}+09:00`);
describe('normalized hierarchical distribution',()=>{
 it('normalizes every hourly profile and rejects invalid weights',()=>{
  for(const p of Object.values(profiles))for(const h of Object.values(p.hourlyProfiles))expect(normalizeWeights(h.weights).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
  for(const w of [[],[0,0],[-1,2],[NaN,1],[Infinity,1]])expect(()=>normalizeWeights(w)).toThrow();
  expect(normalizeWeights([Number.MAX_VALUE,Number.MAX_VALUE])).toEqual([.5,.5]);
 });
 for(const kind of distributionKinds)it(`${kind}: preserves all month/year targets, boundaries, and ordering`,()=>{
  const p=buildCalendarPlan({year:2026,monthlyTargets:targets,annualTarget:total,profile:profiles[kind],calendar});
  expect(p.prefix.at(-1)).toBeCloseTo(total,7);
  for(let m=0;m<12;m++){
   const month=`2026-${String(m+1).padStart(2,'0')}`;
   expect(p.days.slice(p.monthOffsets[m],p.monthOffsets[m+1]).reduce((s,d)=>s+d.target,0)).toBeCloseTo(targets[month],8);
   expect(readCalendarPlan(p,monthStart(month))!.month).toBe(0);
   expect(readCalendarPlan(p,monthStart(addMonths(month,1))-1)!.month).toBeCloseTo(targets[month],2);
  }
  for(let i=0;i<p.days.length;i++){
   const value=readCalendarPlan(p,p.start+i*86400000+86400000-1)!;
   expect(value.day).toBeCloseTo(p.days[i].target,3);expect(value.year!).toBeGreaterThanOrEqual(value.month);expect(value.month).toBeGreaterThanOrEqual(value.day);
   expect(readCalendarPlan(p,p.start+i*86400000)!.day).toBe(0);
  }
  expect(readCalendarPlan(p,p.end-1)!.year).toBeCloseTo(total,2);
  expect(readCalendarPlan(p,p.end)).toBeNull();expect(readCalendarPlan(p,NaN)).toBeNull();
 });
 it('allocates annual-only targets; monthly targets override profiles and cannot be rescaled',()=>{
  const weights={sourceType:'derived' as const,description:'test',weights:[1,2,3,4,5,6,7,8,9,10,11,12]};
  expect(allocateAnnualTarget(12000,2024,weights).reduce((a,b)=>a+b,0)).toBeCloseTo(12000,8);
  const p=buildCalendarPlan({year:2026,annualTarget:12000,profile:profiles.death,calendar});expect(p.prefix.at(-1)).toBeCloseTo(12000,8);
  const changed={...profiles.birth,monthlyProfile:weights};
  const q=buildCalendarPlan({year:2026,monthlyTargets:targets,profile:changed,calendar});expect(q.monthlyTargets).toEqual(Object.values(targets));
  expect(()=>buildCalendarPlan({year:2026,monthlyTargets:targets,annualTarget:1,profile:changed,calendar})).toThrow('disagree');
 });
 it('zero counts, leap day, finite values and deterministic clocks',()=>{
  const p=buildCalendarPlan({year:2024,annualTarget:0,profile:profiles.birth,calendar});expect(p.days).toHaveLength(366);
  expect(readCalendarPlan(p,at('2024-02-29T23:59:59.999'))).toEqual({day:0,month:0,year:0,ratePerSecond:0,dailyTarget:0});
  expect(()=>buildCalendarPlan({year:2026,monthlyTargets:{'2026-10':NaN},profile:profiles.birth,calendar})).toThrow();
  const time=at('2024-02-29T14:30:00');expect(readCalendarPlan(p,time)).toEqual(readCalendarPlan(p,time));
 });
 it('JST independent of device timezone including the new-year boundary',()=>{
  const p=buildCalendarPlan({year:2026,monthlyTargets:targets,profile:profiles.birth,calendar});const old=process.env.TZ;
  try{process.env.TZ='America/Los_Angeles';const a=readCalendarPlan(p,Date.parse('2026-09-30T15:00:00Z'));process.env.TZ='Pacific/Auckland';expect(readCalendarPlan(p,Date.parse('2026-09-30T15:00:00Z'))).toEqual(a);expect(a!.day).toBe(0);expect(a!.month).toBe(0);expect(readCalendarPlan(p,Date.parse('2025-12-31T15:00:00Z'))!.year).toBe(0);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
 });
 it('all hours positive; migration includes nights, weekends and holidays with mild daily differences',()=>{
  for(const k of ['birth','death','inflow','outflow'] as const)for(const h of Object.values(profiles[k].hourlyProfiles))expect(h.weights.every(w=>w>0)).toBe(true);
  expect(profiles.inflow.meaning).toContain('into Japan');expect(profiles.outflow.meaning).toContain('out of Japan');
  expect(profiles.inflow).not.toBe(profiles.outflow);expect(profiles.inflow.hourlyProfiles.weekday.weights).not.toBe(profiles.outflow.hourlyProfiles.weekday.weights);
  for(const k of ['inflow','outflow'] as const){const p=profiles[k];expect(Math.max(...p.daily.weekdayWeights)/Math.min(...p.daily.weekdayWeights)).toBeLessThan(1.05);expect(p.daily.holidayWeight).toBeGreaterThan(.95);const w=normalizeWeights(p.hourlyProfiles.weekday.weights);expect(w.slice(18).reduce((a,b)=>a+b,0)).toBeGreaterThan(.15);}
 });
 it('special marriage dates redistribute a fixed total, including midnight; never apply to divorce',()=>{
  const plain=structuredClone(profiles.marriage);plain.daily.specialDates={};delete plain.daily.matchingMonthDayWeight;
  const a=buildCalendarPlan({year:2026,monthlyTargets:targets,profile:plain,calendar}),b=buildCalendarPlan({year:2026,monthlyTargets:targets,profile:profiles.marriage,calendar});
  const date='2026-11-22';expect(b.days.find(d=>d.date===date)!.target).toBeGreaterThan(a.days.find(d=>d.date===date)!.target);
  expect(b.prefix.at(-1)).toBeCloseTo(a.prefix.at(-1)!,8);
  expect(b.days.find(d=>d.date===date)!.hourlyWeights[0]).toBeGreaterThan(a.days.find(d=>d.date===date)!.hourlyWeights[0]);
  expect(dayCharacteristics(date,profiles.divorce,calendar).special).toBe(false);expect(dayCharacteristics('2026-07-07',profiles.divorce,calendar).special).toBe(false);
 });
 it('official holidays cover substitute and citizens holidays; unlisted years do not invent equinoxes',()=>{
  expect(calendar.dates['2026-05-06']).toBeDefined();expect(calendar.dates['2026-09-22']).toBeDefined();expect(calendar.dates['2027-03-22']).toBeDefined();
  expect(buildCalendarPlan({year:2030,annualTarget:100,profile:profiles.death,calendar}).calendarCovered).toBe(false);
 });
 it('retains existing monthly and annual forecasts through the UI series adapter',()=>{
  const n=fixture(at('2026-10-16T12:00:00')).national;
  for(const group of ['total','japanese','foreign'] as const)for(const [kind,series]of Object.entries(nationalIndicators(n,group))){const p=prepareSeriesPlan(series,2026,profiles[kind as keyof typeof profiles],calendar)!;expect(p.legacy).toBe(false);expect(readSeriesPlan(p,at('2026-12-31T23:59:59.999'))!.year).toBeCloseTo(series.yearToDate['2026-10'].estimatedYearCount!,1);expect(p.plan.monthlyTargets[9]).toBe(series.months['2026-10'].estimatedMonthCount);}
 });
 it('legacy JSON keeps historical aggregate; missing months are unavailable rather than zero',()=>{
  const series=nationalIndicators(fixture(at('2026-10-01T00:00:00')).national,'japanese').birth!;for(const y of Object.values(series.yearToDate))delete y.monthlyTargets;
  const p=prepareSeriesPlan(series,2026,profiles.birth,calendar)!;expect(p.legacy).toBe(true);
  const now=at('2026-10-10T12:00:00');expect(readSeriesPlan(p,now)!.year).toBeCloseTo(series.yearToDate['2026-10'].officialCount+series.yearToDate['2026-10'].estimatedBeforeMonth+readSeriesPlan(p,now)!.month,8);
  expect(readSeriesPlan(p,at('2026-02-01T00:00:00'))).toBeNull();
 });
 it('normalizes real birth CSV and preserves source provenance and unknown-hour allocation',async()=>{
  const h=normalizeHolidays(await readFile('tests/fixtures/jp-holidays.csv'),at('2026-10-02T00:00:00'));
  const p=normalizeBirthDistribution(await readFile('tests/fixtures/birth-hours-2024.csv'),2024,'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040320531&fileKind=1','2025-09-16',h);
  expect(p.daily.sourceYear).toBe(2024);expect(p.daily.weekdayWeights[0]).toBeLessThan(p.daily.weekdayWeights[1]);expect(p.monthlyProfile!.weights.reduce((a,b)=>a+b,0)).toBe(686173);
  expect(eventProfiles(defaultDistribution,'foreign').birth.daily.sourceType).toBe('heuristic');expect(profiles.birth.daily.sourceType).toBe('derived');
 });
 it('national migration uses overseas address relocations; domestic and passenger counts cannot affect it',()=>{
  const d=fixture(at('2026-10-01T00:00:00')), n=d.national;
  const source={...n.migration!.internationalSource,status:'final' as const,statistics:'住民基本台帳人口移動報告',url:'https://www.e-stat.go.jp/dbview?sid=0003423635'};
  const movement={internationalSource:source,domesticSource:n.migration!.domesticSource,
    rows:d.history.vital.map(r=>({month:r.month,regions:{'00':{domesticIn:1,domesticOut:2,internationalIn:1000,internationalOut:700}}}))};
  const a=internationalEvents(movement,['2026-10']);
  expect(a.inflow!.months['2026-10'].estimatedMonthCount).toBe(1000);
  expect(a.outflow!.months['2026-10'].estimatedMonthCount).toBe(700);
  const huge=structuredClone(movement);
  for(const r of huge.rows){r.regions['00'].domesticIn=90000000;r.regions['00'].domesticOut=80000000;}
  expect(internationalEvents(huge,['2026-10'])).toEqual(a);
  const history=d.history.vital.map(r=>({month:r.month,source:r.source,values:{total:r.regions['00'],japanese:r.regions['00'],foreign:r.regions['00']},international:{total:{inflow:99999999,outflow:88888888}}}));
  const grouped=groupEvents(n.vital,history,{total:movement,japanese:movement,foreign:movement},['2026-10']);
  expect(grouped.total.inflow).toEqual(a.inflow);
  expect(()=>groupEvents(n.vital,history,undefined,['2026-10'])).toThrow('国外住所移転');
  expect(()=>internationalEvents({...movement,internationalSource:{...source,statistics:'出入国管理統計'}},['2026-10'])).toThrow('国外住所移転');
  expect(()=>internationalEvents({...movement,internationalSource:{...source,statistics:'人口推計'}},['2026-10'])).toThrow('国外住所移転');
 });
});
it('verified resident-register overseas history reproduces the corrected national forecasts',async()=>{
 const data=JSON.parse(await readFile('tests/fixtures/international-address-moves.json','utf8')) as {source:import('../src/types/statistics').Source;rows:{month:string;counts:number[]}[]};
 expect(data.rows.at(-1)).toEqual({month:'2026-08',counts:[45884,47838,9633,18192,36251,29646]});
 for(const row of data.rows){expect(row.counts[0]).toBe(row.counts[2]+row.counts[4]);expect(row.counts[1]).toBe(row.counts[3]+row.counts[5]);}
 const e=internationalEvents({internationalSource:data.source,rows:data.rows.slice(-66).map(r=>({month:r.month,regions:{'00':{internationalIn:r.counts[0],internationalOut:r.counts[1]}}}))},['2026-10']);
 expect(e.inflow!.months['2026-10'].estimatedMonthCount).toBeCloseTo(71937.8110758767,6);
 expect(e.outflow!.months['2026-10'].estimatedMonthCount).toBeCloseTo(27441.66745802866,6);
 for(const kind of ['inflow','outflow'] as const){
  const plan=prepareSeriesPlan(e[kind]!,2026,profiles[kind],calendar)!;
  expect(readSeriesPlan(plan,at('2026-10-31T23:59:59.999'))!.month).toBeCloseTo(e[kind]!.months['2026-10'].estimatedMonthCount,2);
 }
});
