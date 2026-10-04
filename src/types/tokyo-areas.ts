import {z} from 'zod';
import {regionalSnapshotSchema} from './regional-timeline';
export const TOKYO_AREAS=['wards','tama','islands'] as const;
export type TokyoArea=typeof TOKYO_AREAS[number];
export const TOKYO_AREA_LABELS={all:'全域',wards:'区部',tama:'多摩',islands:'島部'} as const;
export const tokyoAreaSetSchema=z.object({wards:regionalSnapshotSchema,tama:regionalSnapshotSchema,islands:regionalSnapshotSchema});
export const tokyoAreasSchema=z.object({latest:tokyoAreaSetSchema,past:z.record(z.string(),tokyoAreaSetSchema),future:z.record(z.string(),tokyoAreaSetSchema)});
export type TokyoAreaSet=z.infer<typeof tokyoAreaSetSchema>;
export type TokyoAreas=z.infer<typeof tokyoAreasSchema>;

export function validateTokyoTotals(data:TokyoAreas){
 for(const set of [data.latest,...Object.values(data.past),...Object.values(data.future)])for(const area of TOKYO_AREAS){
  const snapshot=set[area];
  for(const g of Object.values(snapshot.groups)){
   if(g.population&&(!Number.isSafeInteger(g.population.value)||g.population.value<=0))throw Error('東京都地域人口が不正です');
   if(g.population&&g.male&&g.female&&g.population.value!==g.male.value+g.female.value)throw Error('東京都地域の男女計が不一致です');
   if(new Set(g.rows.map(r=>`${r.group}/${r.sex}/${r.age}`)).size!==g.rows.length)throw Error('東京都年齢階級が重複しています');
   for(const sex of ['男女計','男','女']as const){const total=g.rows.find(r=>r.sex===sex&&r.age==='総数');if(total&&g.rows.filter(r=>r.sex===sex&&r.age!=='総数').reduce((n,r)=>n+r.value,0)>total.value)throw Error('東京都年齢階級が総数を超えています');}
   if(g.events&&Object.values(g.events).some(v=>v.value<0))throw Error('東京都人口動態の件数が負です');
  }
 }
}
