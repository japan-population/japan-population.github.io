import type {PopulationGroup,Source} from '../types/statistics';
import type {RegionalSnapshot,RegionalMetric} from '../types/regional-timeline';
export function regionalSources(snapshot:RegionalSnapshot|undefined,group:PopulationGroup):Source[]{
 if(!snapshot)return[];const g=snapshot.groups[group];const metrics=[g?.population,g?.averageAge,g?.fertilityRate,snapshot.area,snapshot.density,...Object.values(g?.events??{}),g?.naturalChange,g?.migrationChange];
 const sources=metrics.filter((m):m is RegionalMetric=>Boolean(m)).map(m=>m.source);
 return sources.filter((s,i)=>sources.findIndex(v=>v.url===s.url&&v.sourcePeriod===s.sourcePeriod&&v.scope===s.scope)===i);
}
