import type {PopulationGroup,Source} from '../types/statistics';
import type {RegionalSnapshot,RegionalMetric,RegionalTimeline} from '../types/regional-timeline';
export function availableRegionalPastYears(past:RegionalTimeline['past'],group:PopulationGroup):number[]{
 return Object.entries(past).filter(([,regions])=>Object.values(regions).some(r=>Boolean(r.groups[group]?.population))).map(([year])=>Number(year)).sort((a,b)=>a-b);
}
export function regionalSources(snapshot:RegionalSnapshot|undefined,group:PopulationGroup):Source[]{
 if(!snapshot)return[];const g=snapshot.groups[group];const metrics=[g?.population,g?.averageAge,g?.fertilityRate,snapshot.area,snapshot.density,...Object.values(g?.events??{}),g?.naturalChange,g?.migrationChange];
 const sources=[...(g?.pyramidSource?[g.pyramidSource]:[]),...metrics.filter((m):m is RegionalMetric=>Boolean(m)).map(m=>m.source)];
 return sources.filter((s,i)=>sources.findIndex(v=>v.url===s.url&&v.sourcePeriod===s.sourcePeriod&&v.scope===s.scope)===i);
}
