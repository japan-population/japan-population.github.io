import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {sourceSchema,type CensusSnapshot} from '../../src/types/statistics';
const supplementSchema=z.array(z.object({
  year:z.number().int(),source:sourceSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/),
  rows:z.array(z.object({age:z.enum(['85～89歳','90～94歳','95～99歳','100歳以上']),total:z.number().int().nonnegative(),male:z.number().int().nonnegative(),female:z.number().int().nonnegative()})).length(4)
}));
// Reviewed transcriptions of scanned official tables; hashes identify the checked PDFs.
// Never splice a table excluding Okinawa/foreigners into an inclusive national total.
export async function supplementCensusAges(censuses:CensusSnapshot[]):Promise<CensusSnapshot[]>{
  const supplements=supplementSchema.parse(JSON.parse(await readFile(new URL('../data/census-age-supplements.json',import.meta.url),'utf8')));
  for(const item of supplements){
    const group=censuses.find(c=>c.year===item.year)?.groups.total;
    if(!group)throw new Error('補完対象の国勢調査がありません');
    if(new Set(item.rows.map(r=>r.age)).size!==4||item.rows.some(r=>r.total!==r.male+r.female))throw new Error('原表転記の年齢・男女計が不正です');
    for(const [sex,key]of [['男女計','total'],['男','male'],['女','female']]as const){
      const existing=group.rows.filter(r=>r.sex===sex&&parseInt(r.age)>=85);
      const sum=item.rows.reduce((n,r)=>n+r[key],0);
      if(!existing.length||sum!==existing.reduce((n,r)=>n+r.value,0))throw new Error('原表と時系列表の85歳以上人口が一致しません');
    }
    group.rows=[...group.rows.filter(r=>!(parseInt(r.age)>=85)),...item.rows.flatMap(r=>([['男女計','total'],['男','male'],['女','female']]as const).map(([sex,key])=>({group:'total' as const,sex,age:r.age,value:r[key]})))];
    group.ageSource=item.source;
  }
  return censuses;
}
