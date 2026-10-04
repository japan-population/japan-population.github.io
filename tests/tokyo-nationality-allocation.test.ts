import {expect,test} from 'vitest';
import history from '../scripts/data/tokyo-history.json';
import observations from '../scripts/data/tokyo-nationality-observations.json';
import {enrichTokyoNationalityHistory} from '../scripts/sources/tokyo-nationality-history';
import {allocateReviewedTotal,enrichTokyoNationalityAllocations} from '../scripts/sources/tokyo-nationality-allocation';
import {TOKYO_AREAS,tokyoAreasSchema,validateTokyoTotals} from '../src/types/tokyo-areas';
const input=()=>enrichTokyoNationalityHistory(tokyoAreasSchema.shape.past.parse(history));
const sum=(p:ReturnType<typeof input>,y:number,g:'japanese'|'foreign',s:'male'|'female')=>TOKYO_AREAS.reduce((n,a)=>n+p[y][a].groups[g]![s]!.value,0);
test('参考配分は端数を含めて公表男女総数を保存する',()=>{
 expect(allocateReviewedTotal(127,[2669,1694])).toEqual([78,49]);
 expect(allocateReviewedTotal(2,[4,4])).toEqual([1,1]);
 expect(allocateReviewedTotal(0,[1,2])).toEqual([0,0]);
 for(const weights of [[0,0],[-1,2],[NaN,1],[Infinity],[]])expect(()=>allocateReviewedTotal(2,weights)).toThrow();
 expect(()=>allocateReviewedTotal(-1,[1])).toThrow();
 const p=enrichTokyoNationalityAllocations(input());
 for(const [year,group,male,female]of [[1940,'japanese',3711862,3518220],[1950,'japanese',3142845,3090445],[1950,'foreign',26383,17554],[1960,'foreign',39764,31226],[1970,'foreign',45194,37883],[1980,'japanese',5793927,5713017]]as const){
  expect(sum(p,year,group,'male')).toBe(male);expect(sum(p,year,group,'female')).toBe(female);
 }
 validateTokyoTotals({latest:p[2020],past:p,future:{}});
});
test('1950年は地域別国籍総数と不詳を保存する',()=>{
 const p=enrichTokyoNationalityAllocations(input());
 for(const [area,japanese,foreign,unknown]of [['tama',846157,5135,7],['islands',41001,127,2]]as const){
  const g=p[1950][area].groups;
  expect(g.japanese!.population!.value).toBe(japanese);expect(g.foreign!.population!.value).toBe(foreign);
  expect(g.total!.population!.value-japanese-foreign).toBe(unknown);
 }
});
test('確認済み実数と年齢・動態を維持し、参考値は出典付きで区別する',()=>{
 const before=input(),p=enrichTokyoNationalityAllocations(before);
 expect(before).toEqual(input());expect(enrichTokyoNationalityAllocations(p)).toEqual(p);
 for(const v of observations)for(const metric of ['population','male','female']as const)expect(p[v.year][v.area as 'wards'].groups[v.group as 'foreign']![metric]).toEqual(before[v.year][v.area as 'wards'].groups[v.group as 'foreign']![metric]);
 for(const year of [1940,1950,1960,1970,1980])for(const a of TOKYO_AREAS)for(const g of ['japanese','foreign']as const){
  const current=p[year][a].groups[g]!;
  expect(current.male).toBeDefined();expect(current.female).toBeDefined();
  expect(current.rows).toEqual(before[year][a].groups[g]?.rows??[]);
  expect(current.events).toEqual(before[year][a].groups[g]?.events);
  if(current.population?.reference)expect(current.population.source.status).toBe('reference');
 }
 // Neither the registered foreign population nor another year's population becomes the target.
 expect(sum(p,1960,'foreign','male')+sum(p,1960,'foreign','female')).toBe(70990);
 expect(p[1970].wards.groups.foreign!.population!.reference).toBe(false);
 const changed=input();changed[1960].tama.groups.foreign={rows:[],male:{value:100,source:before[1970].wards.groups.foreign!.population!.source,reference:false}};
 expect(()=>enrichTokyoNationalityAllocations(changed)).toThrow('上書き');
});
