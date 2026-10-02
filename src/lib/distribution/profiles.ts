import baseline from '../../data/distribution-baseline.json';
import { distributionDataSchema, type DistributionData, type DistributionKind, type EventProfile, type WeightedProfile } from '../../types/distribution';
import type { PopulationGroup } from '../../types/statistics';
export const defaultDistribution=distributionDataSchema.parse(baseline);
const hour=(weights:number[],description:string):WeightedProfile=>({sourceType:'heuristic',description,weights});
const make=(meaning:string,weekdayWeights:number[],holidayWeight:number,hours:number[],description:string):EventProfile=>({version:'2026-10-v1',meaning,daily:{sourceType:'heuristic',description,weekdayWeights,holidayWeight,specialDates:{}},hourlyProfiles:Object.fromEntries(['weekday','saturday','sunday','holiday'].map(k=>[k,hour([...hours],description)])) as EventProfile['hourlyProfiles']});
// These are assumptions about timing, not fitted observations or changes to monthly totals.
const death=make('Actual death time, not registration time',[1,1.01,1,1,1,1,.99],1,[.98,.97,.97,.98,1,1.03,1.08,1.12,1.1,1.05,1.01,1,1,.99,.98,.98,.99,1,1.01,1,.99,.98,.97,.97],'死亡時刻の検証済み分布がないため、曜日差を小さく、朝に緩い山を置く独自仮定。冬季増加は既存月次値のみで扱う。');
const inflow=make('international migration into Japan; changes of registered address; not domestic moves or tourists',[1.02,1,1,1,1,1.01,1.02],1.01,[.3,.2,.15,.15,.2,.4,.7,.9,1.1,1.2,1.3,1.35,1.4,1.4,1.4,1.4,1.35,1.35,1.3,1.3,1.2,1,.7,.45],'国外からの住所移転を基礎とする。実際の移動日時は届出統計から確認できない。曜日差は最大2%、日中から夜に多く深夜も正の重みを置く独自仮定。航空旅客数や窓口受付時間は用いない。');
const outflow=make('international migration out of Japan; changes of registered address; not domestic moves or tourists',[1.01,1,1,1,1.01,1.02,1.02],1.01,[.25,.18,.15,.15,.2,.35,.6,1,1.3,1.45,1.5,1.4,1.3,1.35,1.35,1.3,1.3,1.3,1.25,1.15,1,.8,.55,.35],'国外への住所移転を基礎とする。実際の移動日時は届出統計から確認できない。曜日差は最大2%、午前から夜に多く深夜も正の重みを置く独自仮定。入国とは独立した配列。');
const marriage=make('Marriage registration date, including after-hours reception',[.9,1,1,1,1,1.1,1.05],1,[.4,.12,.1,.1,.1,.12,.2,.4,.8,1.8,2,1.8,1.4,1.6,1.7,1.7,1.6,1.4,1,.8,.65,.55,.45,.4],'婚姻届出日の配分の独自仮定。曜日・祝日・記念日を考慮し、時間外受付も0にしない。六曜等の未確認の暦は適用しない。');
marriage.daily.specialDates={'11-22':2.2,'07-07':1.8};marriage.daily.matchingMonthDayWeight=1.4;
marriage.hourlyProfiles.specialDate=hour(marriage.hourlyProfiles.weekday.weights.map((v,h)=>h===0?v*8:v),'人気日の0時台を通常日の8倍の重みとする独自仮定。日総数は変えない。');
const divorce=make('Divorce registration/establishment, including judicial processes',[.4,1.1,1.1,1.1,1.1,1.1,.5],.4,[.15,.1,.1,.1,.1,.12,.2,.4,.9,1.8,2,1.8,1.3,1.8,1.9,1.9,1.6,1.1,.7,.5,.4,.3,.25,.2],'届出・裁判等による成立を含む近似。平日日中に寄せるが休日・夜間も0にしない。婚姻の記念日補正は適用しない。');
export function eventProfiles(data:DistributionData=defaultDistribution,group:PopulationGroup='japanese'):Record<DistributionKind,EventProfile>{
  const birth=structuredClone(data.birthProfile);
  if(group!=='japanese'){
    birth.daily.sourceType='heuristic';birth.daily.description+=' 総数・外国人への適用は日本人の分布を代用する独自仮定。';
    for(const profile of Object.values(birth.hourlyProfiles)){profile.sourceType='heuristic';profile.description+=' 総数・外国人への適用は日本人の分布を代用。';}
    if(birth.monthlyProfile){birth.monthlyProfile.sourceType='heuristic';birth.monthlyProfile.description+=' 国籍区分への転用。';}
  }
  return {birth,death:structuredClone(death),inflow:structuredClone(inflow),outflow:structuredClone(outflow),marriage:structuredClone(marriage),divorce:structuredClone(divorce)};
}
