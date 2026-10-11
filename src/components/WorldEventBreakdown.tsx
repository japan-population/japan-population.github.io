import { useEffect, useMemo, useState } from 'react';
import { eventBreakdownsSchema, type EventBreakdownData } from '../types/statistics';
import { EventBreakdown } from './EventBreakdown';
const cache = new Map<number,Promise<EventBreakdownData[]>>();
export function loadWorldBreakdowns(year:number) {
  if(!Number.isInteger(year)||year<2024||year>2100) return Promise.resolve([]);
  let promise=cache.get(year);
  if(!promise){
    promise=fetch(`${import.meta.env.BASE_URL}world-breakdowns/${year}.json`).then(async response=>{
      if(!response.ok)throw new Error('World breakdown data unavailable');
      return eventBreakdownsSchema.parse(await response.json());
    }).catch(error=>{cache.delete(year);throw error;});
    cache.set(year,promise);
  }
  return promise;
}
// Keep the full-world denominator when limiting the visible categories.
export function worldBreakdownSections(data:EventBreakdownData[],event:'birth'|'death'):EventBreakdownData[] {
  return data.filter(s=>s.event===event).map(section=>{
    if(section.kind==='birthCountry')return {...section,coverage:'partial',items:[...section.items].sort((a,b)=>b.count-a.count).slice(0,10).map((item,i)=>({...item,rank:i+1}))};
    if(section.kind==='cause')return {...section,coverage:'partial',items:section.items.filter(item=>!['道路交通事故','交通事故','その他'].includes(item.label))};
    return section;
  });
}
export function WorldEventBreakdown({event,year,total}:{event:'birth'|'death';year:number;total:number|null}) {
  const [requested,setRequested]=useState(false),[retry,setRetry]=useState(0);
  const [loaded,setLoaded]=useState<{year:number;sections:EventBreakdownData[]}>();
  const [error,setError]=useState(false);
  useEffect(()=>{
    if(!requested)return;
    let cancelled=false;setError(false);
    loadWorldBreakdowns(year).then(sections=>{if(!cancelled)setLoaded({year,sections});}).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[year,requested,retry]);
  const sections=useMemo(()=>loaded?.year===year?worldBreakdownSections(loaded.sections,event):[],[loaded,year,event]);
  return <div className="world-breakdown">
    <EventBreakdown event={event} sections={sections} total={total} kinds={event==='birth'?['birthCountry','motherAge']:['cause','deathAge']} includeCauseSupplements={false} deferClosedContent onOpen={()=>setRequested(true)} loading={!error&&loaded?.year!==year}/>
    {error&&<p className="breakdown-note">読み込めませんでした。<button type="button" onClick={()=>setRetry(n=>n+1)}>再試行</button></p>}
  </div>;
}
