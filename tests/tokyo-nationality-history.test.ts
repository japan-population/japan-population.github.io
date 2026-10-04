import {expect,test} from 'vitest';
import history from '../scripts/data/tokyo-history.json';
import observations from '../scripts/data/tokyo-nationality-observations.json';
import {enrichTokyoNationalityHistory} from '../scripts/sources/tokyo-nationality-history';
import {TOKYO_AREAS,tokyoAreasSchema,tokyoAvailablePastYears} from '../src/types/tokyo-areas';

const input=()=>tokyoAreasSchema.shape.past.parse(history);
test('市町村の再集計は国籍不詳を日本人人口へ混ぜない',()=>{
 const past=enrichTokyoNationalityHistory(input());
 expect(past[2010].tama.groups.japanese!.male!.value).toBe(2041459);
 expect(past[2010].tama.groups.japanese!.female!.value).toBe(2054193);
 const tama=past[2010].tama.groups;
 expect(tama.total!.population!.value-tama.japanese!.population!.value-tama.foreign!.population!.value).toBe(38832);
 const wards=past[1950].wards.groups;
 expect(wards.total!.population!.value-wards.japanese!.population!.value-wards.foreign!.population!.value).toBe(264);
 expect(wards.total!.male!.value-wards.japanese!.male!.value-wards.foreign!.male!.value).toBe(156);
 expect(wards.total!.female!.value-wards.japanese!.female!.value-wards.foreign!.female!.value).toBe(108);
});
test('1920・1930・1980・1990年の外国人男女計が府・都全体の原表と一致する',()=>{
 const past=enrichTokyoNationalityHistory(input());
 for(const [year,male,female]of [[1920,6924,1755],[1930,39159,11775],[1980,47611,42656],[1990,81084,77989]]){
  expect(TOKYO_AREAS.reduce((sum,a)=>sum+past[year][a].groups.foreign!.male!.value,0)).toBe(male);
  expect(TOKYO_AREAS.reduce((sum,a)=>sum+past[year][a].groups.foreign!.female!.value,0)).toBe(female);
 }
 expect(past[1920].islands.groups.foreign!.female!.value).toBe(0);
 expect(past[1930].tama.groups.foreign!.population!.value).toBe(2745);
});
test('原入力・人口動態・年齢分布を変更せず、同じ原表から再生成できる',()=>{
 const before=input(),result=enrichTokyoNationalityHistory(before);
 expect(before).toEqual(input());
 expect(enrichTokyoNationalityHistory(result)).toEqual(result);
 for(const [year,areas]of Object.entries(before))for(const area of TOKYO_AREAS)for(const group of ['total','japanese','foreign']as const){
  expect(result[year][area].groups[group]?.events).toEqual(areas[area].groups[group]?.events);
  expect(result[year][area].groups[group]?.rows??[]).toEqual(areas[area].groups[group]?.rows??[]);
 }
});
test('男女計・基準年・重複・総人口超過を検出する',()=>{
 const v=observations[0];
 expect(()=>enrichTokyoNationalityHistory(input(),[{...v,male:v.male+1}])).toThrow();
 expect(()=>enrichTokyoNationalityHistory(input(),[{...v,year:2000}])).toThrow();
 expect(()=>enrichTokyoNationalityHistory(input(),[v,v])).toThrow();
 expect(()=>enrichTokyoNationalityHistory(input(),[{...v,male:1e8,female:0,population:1e8}])).toThrow();
});
test('都全域の収録状況に依存せず、地域自体に人口がある年を選択できる',()=>{
 const past=enrichTokyoNationalityHistory(input());
 const data=tokyoAreasSchema.parse({latest:past[2020],past,future:{}});
 expect(tokyoAvailablePastYears(data,'wards','japanese')).toContain(1950);
 expect(tokyoAvailablePastYears(data,'tama','japanese')).toContain(2010);
 expect(tokyoAvailablePastYears(data,'tama','japanese')).toContain(1950);
});

test('1980年の日本人は年齢判明分の公表値から配分なしで厳密に集計できる',async()=>{
 const {default:proof}=await import('../scripts/data/tokyo-1980-nationality-verification.json');
 const past=enrichTokyoNationalityHistory(input());
 for(const [i,sex]of (['male','female']as const).entries()){
  // Foreign totals contain no age-unknown remainder. Known-age totals therefore
  // form a complete Japanese/foreign partition, with no unallocated nationality.
  expect(proof.foreignAgeBands[sex].reduce((a,b)=>a+b,0)).toBe(proof.publishedForeign[i]);
  expect(proof.publishedJapanese[i]+proof.publishedForeign[i]).toBe(proof.knownAgeTotal[i]);
  expect(TOKYO_AREAS.reduce((n,a)=>n+proof.regions[a].total[i]-proof.regions[a].unknownAge[i],0)).toBe(proof.knownAgeTotal[i]);
  expect(TOKYO_AREAS.reduce((n,a)=>n+proof.regions[a].foreign[i],0)).toBe(proof.publishedForeign[i]);
  for(const area of TOKYO_AREAS){
   const g=past[1980][area].groups,r=proof.regions[area];
   expect(g.total![sex]!.value).toBe(r.total[i]);
   expect(g.total!.rows.find(v=>v.age==='年齢不詳'&&v.sex===(i===0?'男':'女'))!.value).toBe(r.unknownAge[i]);
   expect(g.foreign![sex]!.value).toBe(r.foreign[i]);
   expect(g.japanese![sex]!.value).toBe(r.total[i]-r.unknownAge[i]-r.foreign[i]);
   expect(g.japanese![sex]!.reference).toBe(false);
   expect(g.japanese![sex]!.source.scope).toContain('年齢不詳を除く');
  }
  expect(TOKYO_AREAS.reduce((n,a)=>n+past[1980][a].groups.japanese![sex]!.value,0)).toBe(proof.publishedJapanese[i]);
 }
});
