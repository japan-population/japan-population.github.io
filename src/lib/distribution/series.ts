import type { EventSeries, YearTotal } from '../../types/statistics';
import type { EventProfile, HolidayCalendar } from '../../types/distribution';
import { buildCalendarPlan, readCalendarPlan, type CalendarPlan, type DistributionEstimate } from './engine';
import { monthKey } from '../time';
export type SeriesPlan={plan:CalendarPlan;legacyYears:Record<string,YearTotal>;legacy:boolean};
export function prepareSeriesPlan(series:EventSeries|undefined,year:number,profile:EventProfile,calendar:HolidayCalendar):SeriesPlan|undefined{
  if(!series)return undefined;
  const annual=Object.entries(series.yearToDate).find(([m,y])=>m.startsWith(`${year}-`)&&y.monthlyTargets)?.[1];
  const monthlyTargets:Record<string,number>={};
  if(annual?.monthlyTargets){
    for(const [m,v]of Object.entries(annual.monthlyTargets))monthlyTargets[m]=v.count;
    for(const [m,model]of Object.entries(series.months))if(m.startsWith(`${year}-`)&&annual.monthlyTargets[m]?.sourceType!=='official'&&Math.abs(monthlyTargets[m]-model.estimatedMonthCount)>1e-6)throw new Error('Forecast and calendar target disagree');
  }else{
    // Compatibility with already published JSON: retain known month totals and the
    // historical aggregate. Do not fabricate a month-by-month history from an annual sum.
    for(const [m,model]of Object.entries(series.months))if(m.startsWith(`${year}-`))monthlyTargets[m]=model.estimatedMonthCount;
  }
  if(!Object.keys(monthlyTargets).length)return undefined;
  return {plan:buildCalendarPlan({year,monthlyTargets,annualTarget:annual?.estimatedYearCount,profile,calendar}),legacyYears:series.yearToDate,legacy:!annual};
}
export function readSeriesPlan(prepared:SeriesPlan|undefined,now:number):DistributionEstimate|null{
  if(!prepared)return null;const value=readCalendarPlan(prepared.plan,now);if(!value)return null;
  if(prepared.legacy){const y=prepared.legacyYears[monthKey(now)];value.year=y?y.officialCount+y.estimatedBeforeMonth+value.month:null;}
  return value;
}
