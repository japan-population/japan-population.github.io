import {expect,test,vi} from 'vitest';
import {readDataset,semanticJSON} from '../scripts/dataset';
import {monthlySignature,updateMonthly,updateRegional,monthlySources} from '../scripts/scoped-update';
const now=Date.parse('2026-10-05T18:00:00+09:00');
test('取得日時・予測期間だけでは月次の新着と判定せず、公表値・公表日変更を検出する',async()=>{
 const a=await readDataset('public/data'),b=structuredClone(a),signature=monthlySignature(a);
 b.manifest.generatedAt=new Date(now).toISOString();b.manifest.forecastMonths=['2026-11','2026-12','2027-01'];
 b.national.population.base+=100; // display model alone is not an observation
 b.history.population.at(-1)!.source.retrievedAt=new Date(now).toISOString();
 expect(monthlySignature(b)).toBe(signature);
 b.history.population.at(-1)!.value+=1;expect(monthlySignature(b)).not.toBe(signature);
 const c=structuredClone(a);c.national.eventsByGroup!.foreign.inflow!.source.publishedAt='2026-10-05';expect(monthlySignature(c)).not.toBe(signature);
});
test('地域更新は全国・過去・未来を変更せず地域の最新公表値だけ更新する',async()=>{
 const old=await readDataset('public/data'),before=semanticJSON(old);
 const official=Object.fromEntries(Object.entries(old.prefectures).map(([c,p])=>[c,structuredClone(p.officialPopulation!)]));
 const details=Object.fromEntries(Object.entries(old.prefectures).map(([c,p])=>[c,structuredClone(p.detail!)]));
 official['13'].total.value+=1;
 const sources={fetchTokyoLatest:vi.fn(async()=>structuredClone(old.tokyoAreas!.latest)),fetchCensusRegions:vi.fn(async()=>official),fetchRegionalDetails:vi.fn(async()=>details)};
 const next=await updateRegional(old,now,sources);
 expect(next.prefectures['13'].officialPopulation!.total.value).toBe(old.prefectures['13'].officialPopulation!.total.value+1);
 expect(semanticJSON(next.national)).toBe(semanticJSON(old.national));expect(next.regionalTimeline).toEqual(old.regionalTimeline);expect(next.tokyoAreas?.past).toEqual(old.tokyoAreas?.past);expect(next.tokyoAreas?.future).toEqual(old.tokyoAreas?.future);expect(next.history).toEqual(old.history);
 expect(semanticJSON(old)).toBe(before);expect(sources.fetchCensusRegions).toHaveBeenCalledOnce();expect(sources.fetchRegionalDetails).toHaveBeenCalledOnce();
});
test('月次の取得元に過去・未来・地域年次を含めず、取得失敗時は元データを保持',async()=>{
 expect(Object.keys(monthlySources).sort()).toEqual(['fetchBreakdown','fetchExactPopulation','fetchMigration','fetchNationalEvents','fetchPopulation','fetchVital'].sort());
 const old=await readDataset('public/data'),before=semanticJSON(old);
 await expect(updateMonthly(old,'test',now,{...monthlySources,fetchPopulation:async()=>{throw Error('offline');}})).rejects.toThrow('offline');
 expect(semanticJSON(old)).toBe(before);
});
test('月次更新を再構築しても保存済みの過去統計・将来推計・地域年次は保持する',async()=>{
 const {addMonths}=await import('../src/lib/time');
 const old=await readDataset('public/data');
 const groups=['total','japanese','foreign']as const;
 const exact=Object.fromEntries(groups.map(g=>{const p=old.national.breakdown!.groups[g];return[g,Array.from({length:13},(_,i)=>({month:addMonths(p.source.sourcePeriod,i-12),value:Math.round(p.yearAgo+(p.base-p.yearAgo)*i/12),source:{...p.source,sourcePeriod:addMonths(p.source.sourcePeriod,i-12)}}))];}))as Awaited<ReturnType<typeof monthlySources.fetchExactPopulation>>;
 const vital=old.history.vital,latest=vital.at(-1)!.month;
 const movement={domesticSource:{...old.national.eventsByGroup!.total.inflow!.source,sourcePeriod:latest},internationalSource:{...old.national.eventsByGroup!.total.inflow!.source,sourcePeriod:latest},rows:vital.map(r=>({month:r.month,regions:Object.fromEntries(Object.entries(r.regions).map(([c,v])=>[c,{domesticIn:v.birth*3,domesticOut:v.birth*3,internationalIn:v.marriage,internationalOut:v.divorce}]))}))};
 const events=vital.map(r=>({month:r.month,source:r.source,values:{total:{birth:r.regions['00'].birth,death:r.regions['00'].death},japanese:{birth:r.regions['00'].birth-1000,death:r.regions['00'].death-1000},foreign:{birth:1000,death:1000}}}));
 const next=await updateMonthly(old,'test',now,{fetchPopulation:async()=>structuredClone(old.history.population),fetchVital:async()=>structuredClone(vital),fetchBreakdown:async()=>structuredClone(old.national.breakdown!),fetchExactPopulation:async()=>exact,fetchMigration:async()=>movement,fetchNationalEvents:async()=>events});
 for(const key of ['archive','projections','populationTrend','eventBreakdowns','nationalities','distribution']as const)expect(next.national[key]).toEqual(old.national[key]);
 expect(next.regionalTimeline).toEqual(old.regionalTimeline);expect(next.tokyoAreas?.past).toEqual(old.tokyoAreas?.past);expect(next.tokyoAreas?.future).toEqual(old.tokyoAreas?.future);
 for(const code of Object.keys(old.prefectures)){expect(next.prefectures[code].detail).toEqual(old.prefectures[code].detail);expect(next.prefectures[code].officialPopulation).toEqual(old.prefectures[code].officialPopulation);}
});
