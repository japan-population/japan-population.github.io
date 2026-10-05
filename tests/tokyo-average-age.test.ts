import {describe,it,expect} from 'vitest';
import history from '../scripts/data/tokyo-history.json';
import observations from '../scripts/data/tokyo-average-age.json';
import {tokyoAreasSchema} from '../src/types/tokyo-areas';
import {combinePublishedAges,groupedAverageAge,enrichTokyoAverageAges} from '../scripts/sources/tokyo-average-age';

const past=tokyoAreasSchema.shape.past.parse(history);
describe('東京都地域別平均年齢',()=>{
 it('公表平均は年齢既知人口で加重し、地域の単純平均にしない',()=>{
  expect(combinePublishedAges([{code:'13201',knownPopulation:900,mean:40},{code:'13303',knownPopulation:100,mean:60}])).toBe(42);
  expect(()=>combinePublishedAges([{code:'13201',knownPopulation:1,mean:40},{code:'13201',knownPopulation:1,mean:60}])).toThrow('重複');
  expect(()=>combinePublishedAges([{code:'13201',knownPopulation:0,mean:40}])).toThrow();
 });
 it('階級からの平均は中央値を使い、欠けた階級を見逃さない',()=>{
  expect(groupedAverageAge([{lower:0,width:5,count:3},{lower:5,width:5,count:1}])).toBe(3.75);
  expect(()=>groupedAverageAge([{lower:5,width:5,count:1}])).toThrow('不連続');
  expect(()=>groupedAverageAge([{lower:0,width:5,count:0}])).toThrow();
 });
 it('公表平均を優先し、人口・年齢内訳を変更せず国籍と基準年を維持する',()=>{
  const before=structuredClone(past),result=enrichTokyoAverageAges(past);
  expect(past).toEqual(before);
  for(const o of observations){
   const g=result[String(o.year)][o.area as 'wards'|'tama'|'islands'].groups[o.group as 'total'|'japanese'|'foreign']!;
   expect(g.averageAge!.reference).toBe(o.method==='grouped');
   expect(g.averageAge!.source.sourcePeriod).toBe(`${o.year}-10`);
   expect(g.population).toEqual(before[String(o.year)][o.area as 'wards'|'tama'|'islands'].groups[o.group as 'total'|'japanese'|'foreign']!.population);
   expect(g.rows).toEqual(before[String(o.year)][o.area as 'wards'|'tama'|'islands'].groups[o.group as 'total'|'japanese'|'foreign']!.rows);
  }
  expect(result['2010'].tama.groups.japanese!.averageAge!.reference).toBe(false);
  expect(result['2020'].wards.groups.total!.averageAge!.value).toBe(44.76519);
  expect(result['1920'].wards.groups.foreign!.averageAge).toBeUndefined();
 });
 it('旧田無・保谷の再掲を重複せず、2000年の三宅村避難も正しく扱う',()=>{
  for(const o of observations.filter(o=>o.method==='published')){
   const components=o.components!;
   if(o.year>=2010&&o.area==='tama'){
    expect(components).toHaveLength(30);
    expect(components.some(p=>['13216','13217'].includes(p.code))).toBe(false);
   }
   if(o.year===2000&&o.area==='islands')expect(components).toHaveLength(8);
   const g=past[String(o.year)][o.area as 'wards'|'tama'|'islands'].groups[o.group as 'total'|'japanese']!;
   const unknown=g.rows.find(r=>r.sex==='男女計'&&r.age==='年齢不詳')?.value;
   if(unknown!==undefined)expect(components.reduce((n,p)=>n+p.knownPopulation,0)).toBe(g.population!.value-unknown);
  }
 });
 it('差引き外国人分布と日本人分布を、それぞれ公表人口に照合する',()=>{
  for(const o of observations.filter(o=>o.method==='grouped'&&o.group!=='total')){
   const g=past[String(o.year)][o.area as 'wards'|'tama'|'islands'].groups[o.group as 'japanese'|'foreign']!;
   expect(o.bins!.reduce((n,b)=>n+b.count,0)).toBe(g.population!.value);
  }
 });
 it('年月不一致・重複・対象人口超過を拒否する',()=>{
  const o=observations[0];
  expect(()=>enrichTokyoAverageAges(past,[o,o])).toThrow('重複');
  expect(()=>enrichTokyoAverageAges(past,[{...o,source:{...o.source,sourcePeriod:'2001-10'}}])).toThrow('基準年月');
  expect(()=>enrichTokyoAverageAges(past,[{...o,components:[{code:'13100',knownPopulation:1e9,mean:40}]}])).toThrow('対象人口');
 });
});
