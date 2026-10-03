import {createHash} from 'node:crypto';
import {buildDataset,semanticJSON,type Dataset} from './dataset';
import {populationModel} from './models/population-model';
import {populationGroups} from '../src/types/statistics';
import {fetchPopulation} from './sources/population';
import {fetchVital} from './sources/vital';
import {fetchBreakdown} from './sources/breakdown';
import {fetchExactPopulation} from './sources/exact-population';
import {fetchMigration} from './sources/migration';
import {fetchNationalEvents} from './sources/national-events';
import {fetchCensusRegions} from './sources/census-regions';
import {fetchRegionalDetails} from './sources/regional-details';

export const monthlySources={fetchPopulation,fetchVital,fetchBreakdown,fetchExactPopulation,fetchMigration,fetchNationalEvents};
export const regionalSources={fetchCensusRegions,fetchRegionalDetails};
export function finalizeDataset(data:Dataset,now:number){
 data.manifest.generatedAt=new Date(now).toISOString();
 const id=createHash('sha256').update(semanticJSON(data)).digest('hex').slice(0,16);
 data.manifest.generationId=id;data.national.generationId=id;return data;
}
// Compare official observations and publication metadata, never rolling forecast dates
// or retrieval timestamps. Any newly published monthly source ends this month's polling.
export function monthlySignature(data:Dataset){
 const n=data.national;
 return semanticJSON({population:data.history.population,vital:data.history.vital,breakdown:n.breakdown,
  eventSources:n.eventsByGroup&&Object.fromEntries(Object.entries(n.eventsByGroup).map(([g,events])=>[g,Object.fromEntries(Object.entries(events).map(([k,e])=>[k,e.source]))])),
  domestic:n.migration?.domesticSource,international:n.migration?.internationalSource});
}
export async function updateMonthly(previous:Dataset,appId:string,now:number,sources=monthlySources):Promise<Dataset>{
 let population=await sources.fetchPopulation(appId,now);
 const vital=await sources.fetchVital(now),breakdown=await sources.fetchBreakdown(appId,now),exact=await sources.fetchExactPopulation(now);
 for(const group of populationGroups){
  const precise=populationModel(exact[group]),rounded=breakdown.groups[group];
  if(precise.baseDate!==rounded.baseDate||Math.abs(precise.base-rounded.base)>500||Math.abs(precise.yearAgo-rounded.yearAgo)>500)throw Error('人口参考表と人口内訳が不一致です');
  breakdown.groups[group]=precise;
 }
 const exactByMonth=new Map(exact.total.map(r=>[r.month,r]));population=population.map(r=>exactByMonth.get(r.month)??r);
 const migration=await sources.fetchMigration(appId,now),japanese=await sources.fetchMigration(appId,now,'japanese'),foreign=await sources.fetchMigration(appId,now,'foreign');
 const nationalEvents=await sources.fetchNationalEvents(now);
 const old=previous.national;
 const data=buildDataset(population,vital,'official',now,{includeRegionalModels:false,breakdown,bases:{},migration,nationalEvents,migrationsByGroup:{total:migration,japanese,foreign},
  regionalDetails:Object.fromEntries(Object.entries(previous.prefectures).filter(([,p])=>p.detail).map(([c,p])=>[c,p.detail!])),
  officialRegions:Object.fromEntries(Object.entries(previous.prefectures).filter(([,p])=>p.officialPopulation).map(([c,p])=>[c,p.officialPopulation!])),
  regionalTimeline:previous.regionalTimeline,archive:old.archive,projections:old.projections,populationTrend:old.populationTrend,
  nationalities:old.nationalities,eventBreakdowns:old.eventBreakdowns,distribution:old.distribution});
 return finalizeDataset(data,now);
}
export async function updateRegional(previous:Dataset,now:number,sources=regionalSources):Promise<Dataset>{
 const official=await sources.fetchCensusRegions(now),details=await sources.fetchRegionalDetails(now);
 const data=structuredClone(previous);
 for(const [code,p]of Object.entries(data.prefectures)){
  if(!official[code]||!details[code])throw Error('地域データが不足しています');
  p.officialPopulation=official[code];p.detail=details[code];
 }
 // Historical census snapshots and all projections are deliberately left untouched.
 return finalizeDataset(data,now);
}
