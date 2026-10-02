import type {EventBreakdownData,EventBreakdowns,EventKind,PopulationGroup} from '../types/statistics';
export function selectEventBreakdowns(data:EventBreakdowns|undefined,event:EventKind,group:PopulationGroup,year?:number,previous=false):EventBreakdownData[]{
  const available=(data??[]).filter(s=>s.event===event&&s.group===group&&(year===undefined||s.year===year));
  if(year!==undefined){
    if(!previous)return available;
    return BREAKDOWN_KINDS[event].flatMap(kind=>{const exact=available.find(s=>s.kind===kind);return exact?[exact]:(data??[]).filter(s=>s.event===event&&s.group===group&&s.kind===kind&&s.year<year).sort((a,b)=>b.year-a.year).slice(0,1);});
  }
  // Each category may have its own latest publication year; never mix years within a category.
  return available.filter(s=>!available.some(other=>other.kind===s.kind&&other.year>s.year));
}
export function breakdownCount(section:EventBreakdownData,count:number,total?:number):{count:number;percent:number}{
  const ratio=section.total>0?count/section.total:0;
  // Floor only for display, independently in every category. This keeps each counter monotone;
  // rounding differences are not assigned to an unrelated category.
  return {count:total===undefined?count:Math.floor(Math.max(0,total)*ratio),percent:ratio*100};
}
export const BREAKDOWN_LABELS={motherAge:'出産年齢（母）',birthOrder:'出生順位',deathAge:'死亡年齢',cause:'死因',husbandAge:'夫の年齢',wifeAge:'妻の年齢'};
export const BREAKDOWN_KINDS={birth:['birthOrder','motherAge'],death:['cause','deathAge'],marriage:['husbandAge','wifeAge'],divorce:['husbandAge','wifeAge']} as const;
export function realtimeEventBreakdowns(data:EventBreakdowns|undefined,event:EventKind,group:PopulationGroup){
  if(group==='foreign'&&(event==='marriage'||event==='divorce'))return {sections:[],proxy:false};
  const target=(event==='marriage'||event==='divorce')?'japanese':group;
  const own=selectEventBreakdowns(data,event,target);
  if(own.length)return {sections:own,proxy:false};
  return {sections:selectEventBreakdowns(data,event,'japanese'),proxy:target!=='japanese'};
}
