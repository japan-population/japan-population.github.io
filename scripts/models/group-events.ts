import { EVENTS, populationGroups, type EventSeries, type GroupedEvents, type Vital, type VitalObservation } from '../../src/types/statistics';
import { eventModel } from './event-model';
import { yearModel } from './year-model';
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
    if (!movement) throw new Error('国外住所移転の国籍別データが不足しています');
    Object.assign(result[group], internationalEvents(movement, months));
  }
  for (const kind of ['marriage','divorce'] as const) result.japanese[kind] = {source:vital.source,months:Object.fromEntries(Object.entries(vital.months).map(([m,models])=>[m,models[kind]])),yearToDate:Object.fromEntries(Object.entries(vital.yearToDate ?? {}).map(([m,models])=>[m,models[kind]]))} satisfies EventSeries;
  return result;
}

// Only overseas changes of registered address enter national movement counters.
// Domestic relocation and population-estimate entry/exit totals are not inputs.
export function internationalEvents(movement: {
  internationalSource: MigrationHistory['internationalSource'];
  rows: {month:string; regions:Record<string,{internationalIn:number;internationalOut:number}>}[];
}, months:string[]): Pick<GroupedEvents['total'],'inflow'|'outflow'> {
  const source = movement.internationalSource;
  if (source.status!=='fixture' && (source.statistics!=='住民基本台帳人口移動報告' || source.url!=='https://www.e-stat.go.jp/dbview?sid=0003423635')) {
    throw new Error('全国転入・転出には住民基本台帳の国外住所移転を使用してください');
  }
  const result: Pick<GroupedEvents['total'],'inflow'|'outflow'> = {};
  for (const [kind,key] of [['inflow','internationalIn'],['outflow','internationalOut']] as const) {
    const rows: VitalObservation[] = movement.rows.map(r=>({month:r.month,source,regions:{'00':Object.fromEntries(EVENTS.map(k=>[k,r.regions['00']?.[key]])) as VitalObservation['regions'][string]}}));
    const forecast = (month:string) => eventModel(rows,'00',month,true).birth;
    result[kind] = {source, months:Object.fromEntries(months.map(m=>[m,forecast(m)])),
      yearToDate:Object.fromEntries(months.map(m=>[m,yearModel([key],m,source.sourcePeriod,
        t=>{const row=movement.rows.find(r=>r.month===t);return row?.regions['00'];},
        t=>({[key]:forecast(t).estimatedMonthCount}) as Record<typeof key,number>)[key]]))};
  }
  return result;
}
