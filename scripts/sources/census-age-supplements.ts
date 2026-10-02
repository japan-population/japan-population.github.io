import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {sourceSchema,type CensusSnapshot} from '../../src/types/statistics';
const ageRowsSchema=z.array(z.object({age:z.enum(['85～89歳','90～94歳','95～99歳','100歳以上']),total:z.number().int().nonnegative(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative()})).length(4);
const componentSchema=z.object({source:sourceSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/),rows:ageRowsSchema});
const supplementSchema=z.array(componentSchema.extend({year:z.number().int(),coverage:z.literal('partial').optional(),unallocated:z.object({total:z.number().int().nonnegative(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative(),source:sourceSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional(),components:z.array(componentSchema).min(2).optional()}));
// Reviewed transcriptions of scanned official tables; hashes identify the checked PDFs.
// Never splice a table excluding Okinawa/foreigners into an inclusive national total.
export async function supplementCensusAges(censuses:CensusSnapshot[]):Promise<CensusSnapshot[]>{
  const supplements=supplementSchema.parse(JSON.parse(await readFile(new URL('../data/census-age-supplements.json',import.meta.url),'utf8')));
  for(const item of supplements){
    const group=censuses.find(c=>c.year===item.year)?.groups.total;
    if(!group)throw new Error('補完対象の国勢調査がありません');
    if(new Set(item.rows.map(r=>r.age)).size!==4||item.rows.some(r=>r.total!==r.male+r.female))throw new Error('原表転記の年齢・男女計が不正です');
    if((item.coverage==='partial')!==!!item.unallocated||item.unallocated&&item.unallocated.total!==item.unallocated.male+item.unallocated.female)throw new Error('補完範囲の指定が不正です');
    for(const [sex,key]of [['男女計','total'],['男','male'],['女','female']]as const){
      const existing=group.rows.filter(r=>r.sex===sex&&parseInt(r.age)>=85);
      const sum=item.rows.reduce((n,r)=>n+r[key],0);
      if(!existing.length||sum+(item.unallocated?.[key]??0)!==existing.reduce((n,r)=>n+r.value,0))throw new Error('原表と時系列表の85歳以上人口が一致しません');
    }
    if(item.coverage==='partial'){
      const row=item.rows.find(r=>r.age==='100歳以上')!;
      group.ageReference={age:'100歳以上',total:row.total,male:row.male,female:row.female,scopeLabel:'沖縄を除く',source:item.source};
      group.ageSupportingSources=[item.unallocated!.source];
      continue;
    }
    if(item.components){
      for(const component of item.components){
        if(new Set(component.rows.map(r=>r.age)).size!==4||component.rows.some(r=>r.total!==r.male+r.female))throw new Error('地域別原表の年齢・男女計が不正です');
      }
      for(const row of item.rows)for(const key of ['total','male','female']as const){
        if(item.components.reduce((sum,c)=>sum+c.rows.find(r=>r.age===row.age)![key],0)!==row[key])throw new Error('地域別原表と補完値が一致しません');
      }
      group.ageSupportingSources=item.components.slice(1).map(c=>c.source);
    }
    group.rows=[...group.rows.filter(r=>!(parseInt(r.age)>=85)),...item.rows.flatMap(r=>([['男女計','total'],['男','male'],['女','female']]as const).map(([sex,key])=>({group:'total' as const,sex,age:r.age,value:r[key]})))];
    group.ageSource=item.source;
  }
  return censuses;
}
