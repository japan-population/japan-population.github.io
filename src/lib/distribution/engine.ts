import { monthStart, secondsInMonth, dayStart } from '../time';
import type { EventProfile, HolidayCalendar, WeightedProfile } from '../../types/distribution';
import { eventProfileSchema } from '../../types/distribution';
import { normalizeWeights, buildPrefixSums } from './weights';
export type DailyPlan={date:string;target:number;hourlyWeights:number[];hourlyPrefix:number[];special:boolean};
export type CalendarPlan={year:number;start:number;end:number;days:DailyPlan[];prefix:number[];monthOffsets:number[];monthlyTargets:(number|null)[];annualTarget:number|null;calendarCovered:boolean};
export type DistributionEstimate={day:number;month:number;year:number|null;ratePerSecond:number;dailyTarget:number};
export function dayCharacteristics(date:string,profile:EventProfile,calendar:HolidayCalendar){
  const d=new Date(`${date}T00:00:00Z`),year=d.getUTCFullYear(),month=d.getUTCMonth()+1,day=d.getUTCDate(),weekday=d.getUTCDay();
  const holiday=year>=calendar.fromYear&&year<=calendar.throughYear&&!!calendar.dates[date];
  const factor=profile.daily.specialDates[date.slice(5)]??(month===day?profile.daily.matchingMonthDayWeight:undefined);
  const special=factor!==undefined;
  const dayType=special&&profile.hourlyProfiles.specialDate?'specialDate':holiday?'holiday':weekday===6?'saturday':weekday===0?'sunday':'weekday';
  return {special,weight:(holiday?profile.daily.holidayWeight:profile.daily.weekdayWeights[weekday])*(factor??1),hours:profile.hourlyProfiles[dayType]!};
}
/** Only used when no monthly targets are available. Never overwrite existing monthly totals. */
export function allocateAnnualTarget(annualTarget:number,year:number,profile?:WeightedProfile):number[]{
  if(!Number.isFinite(annualTarget)||annualTarget<0)throw new Error('Invalid annual target');
  const weights=profile?.weights??Array.from({length:12},(_,i)=>secondsInMonth(`${year}-${String(i+1).padStart(2,'0')}`));
  if(weights.length!==12)throw new Error('12 monthly weights required');
  return normalizeWeights(weights).map(w=>w*annualTarget);
}
export function buildCalendarPlan({year,monthlyTargets={},annualTarget,profile,calendar}:{year:number;monthlyTargets?:Record<string,number>;annualTarget?:number;profile:EventProfile;calendar:HolidayCalendar}):CalendarPlan{
  if(!Number.isInteger(year)||year<1900||year>9998)throw new Error('Invalid year');
  eventProfileSchema.parse(profile);
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
  if(Object.keys(monthlyTargets).some(m=>!months.includes(m)))throw new Error('Monthly target outside year');
  let targets=months.map(m=>monthlyTargets[m]??null);
  if(targets.every(v=>v===null)&&annualTarget!==undefined)targets=allocateAnnualTarget(annualTarget,year,profile.monthlyProfile);
  // Missing monthly counts cannot be invented by repartitioning an existing annual total.
  const complete=targets.every(v=>v!==null);
  if(targets.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw new Error('Invalid monthly target');
  const sum=targets.reduce<number>((a,b)=>a+(b??0),0);
  if(!Number.isFinite(sum))throw new Error('Annual total overflow');
  if(annualTarget!==undefined&&complete&&Math.abs(sum-annualTarget)>Math.max(1e-7,annualTarget*1e-12))throw new Error('Monthly and annual totals disagree');
  const days:DailyPlan[]=[],monthOffsets:number[]=[];
  for(let m=0;m<12;m++){
    monthOffsets.push(days.length);const start=monthStart(months[m]),length=secondsInMonth(months[m])/86400;
    const dates=Array.from({length},(_,i)=>new Date(start+i*86400000+9*3600000).toISOString().slice(0,10));
    const traits=dates.map(d=>dayCharacteristics(d,profile,calendar)),weights=normalizeWeights(traits.map(d=>d.weight));
    dates.forEach((date,i)=>{const hourlyWeights=normalizeWeights(traits[i].hours.weights);days.push({date,target:(targets[m]??0)*weights[i],hourlyWeights,hourlyPrefix:buildPrefixSums(hourlyWeights),special:traits[i].special});});
  }
  monthOffsets.push(days.length);
  const prefix=buildPrefixSums(days.map(d=>d.target));
  return {year,start:monthStart(`${year}-01`),end:monthStart(`${year+1}-01`),days,prefix,monthOffsets,monthlyTargets:targets,annualTarget:complete?sum:null,calendarCovered:year>=calendar.fromYear&&year<=calendar.throughYear};
}
/** O(1): calendar rules and normalization run only during plan construction. */
export function readCalendarPlan(plan:CalendarPlan,now:number):DistributionEstimate|null{
  if(!Number.isFinite(now)||now<plan.start||now>=plan.end)return null;
  const dayIndex=Math.floor((now-plan.start)/86400000),today=plan.days[dayIndex],month=new Date(now+9*3600000).getUTCMonth();
  if(plan.monthlyTargets[month]===null)return null;
  const hours=(now-dayStart(now))/3600000,hour=Math.floor(hours);
  const progress=today.hourlyPrefix[hour]+today.hourlyWeights[hour]*(hours-hour);
  const day=Math.min(today.target,today.target*progress),monthCount=plan.prefix[dayIndex]-plan.prefix[plan.monthOffsets[month]]+day;
  return {day,month:Math.min(plan.monthlyTargets[month]!,Math.max(day,monthCount)),year:plan.annualTarget===null?null:Math.max(monthCount,plan.prefix[dayIndex]+day),ratePerSecond:today.target*today.hourlyWeights[hour]/3600,dailyTarget:today.target};
}
