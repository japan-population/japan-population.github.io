import { EVENTS, populationGroups, type EventSeries, type GroupedEvents, type Vital, type VitalObservation } from '../../src/types/statistics';
import { eventModel } from './event-model';
import { yearModel } from './year-model';
import { migrationModel } from './reference-model';
import type { MigrationHistory } from '../sources/migration';
import type { BirthDeathRow } from '../sources/national-events';
export function groupEvents(vital: Vital, history: BirthDeathRow[], migrations: Record<typeof populationGroups[number], MigrationHistory> | undefined, months: string[]): GroupedEvents {
  const latest = history.at(-1); if (!latest) throw new Error('国籍別の人口動態がありません');
  const result = {total:{},japanese:{},foreign:{}} as GroupedEvents;
  for (const group of populationGroups) {
    for (const kind of ['birth','death'] as const) {
      // Adapt one count series to the shared checked seasonal model; only `birth` is read.
      const rows: VitalObservation[] = history.map(r=>({month:r.month,source:r.source,regions:{'00':Object.fromEntries(EVENTS.map(k=>[k,r.values[group][kind]])) as VitalObservation['regions'][string]}}));
      const forecast = (m:string) => eventModel(rows,'00',m,true).birth;
      result[group][kind] = {source:{...latest.source,scope:`${group === 'total' ? '総数' : group === 'japanese' ? '日本人' : '外国人'}。${latest.source.scope}`},months:Object.fromEntries(months.map(m=>[m,forecast(m)])),yearToDate:Object.fromEntries(months.map(m=>[m,yearModel([kind],m,latest.month,t=>{const r=history.find(r=>r.month===t);return r ? {[kind]:r.values[group][kind]} as Record<typeof kind,number> : undefined;},t=>({[kind]:forecast(t).estimatedMonthCount}) as Record<typeof kind,number>)[kind]]))};
    }
    const movement = migrations?.[group];
    for (const [kind,key] of [['inflow','internationalIn'],['outflow','internationalOut']] as const) {
      if(history.every(r=>r.international)) {
        const rows:VitalObservation[]=history.map(r=>({month:r.month,source:r.source,regions:{'00':Object.fromEntries(EVENTS.map(k=>[k,r.international![group][kind]])) as VitalObservation['regions'][string]}}));
        const forecast=(m:string)=>eventModel(rows,'00',m,true).birth;
        result[group][kind]={source:{...latest.source,table:'参考表 全国人口の推移（入国者数・出国者数）',scope:'人口推計の常住人口に関わる国際移動。国内移動を含まず、滞在期間90日以内の短期出入国を除いた入国者数・出国者数。国籍異動による純増減は含まない。'},months:Object.fromEntries(months.map(m=>[m,forecast(m)])),yearToDate:Object.fromEntries(months.map(m=>[m,yearModel([kind],m,latest.month,t=>{const r=history.find(r=>r.month===t);return r?{[kind]:r.international![group][kind]} as Record<typeof kind,number>:undefined;},t=>({[kind]:forecast(t).estimatedMonthCount}) as Record<typeof kind,number>)[kind]]))};
      } else {
        if(latest.source.status!=='fixture'||!movement)throw new Error('常住人口の入出国者数が不足しています');
        const forecast = (m:string) => migrationModel(movement,'00',m,true)[key];
        result[group][kind] = {source:movement.internationalSource,months:Object.fromEntries(months.map(m=>[m,forecast(m)])),yearToDate:Object.fromEntries(months.map(m=>[m,yearModel([key],m,movement.internationalSource.sourcePeriod,t=>{const r=movement.rows.find(r=>r.month===t);return r ? {[key]:r.regions['00'][key]} as Record<typeof key,number> : undefined;},t=>({[key]:forecast(t).estimatedMonthCount}) as Record<typeof key,number>)[key]]))};
      }
    }
  }
  for (const kind of ['marriage','divorce'] as const) result.japanese[kind] = {source:vital.source,months:Object.fromEntries(Object.entries(vital.months).map(([m,models])=>[m,models[kind]])),yearToDate:Object.fromEntries(Object.entries(vital.yearToDate ?? {}).map(([m,models])=>[m,models[kind]]))} satisfies EventSeries;
  return result;
}
