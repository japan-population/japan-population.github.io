import {expect,test} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {readAnnualResiduals,annualResidualMetric,annualResidualSchema} from '../scripts/sources/regional-annual-residuals';
import {RegionalSnapshotIndicators} from '../src/components/RegionalSnapshotDetail';

test('2010年は人数の同期間計算表から単年残差を計算し補間補正を明示',async()=>{
 const data=await readAnnualResiduals(),entry=data.entries.find(e=>e.year===2010)!;
 const value=annualResidualMetric(entry,'01',data.retrievedAt);
 expect(value.value).toBe(5506419-5523526-(-14342));expect(value.value).toBe(-2765);
 expect(value.calculation).toMatchObject({method:'single-year',startDate:'2009-10-01',endDate:'2010-10-01',naturalBasis:'official-count'});
 expect(value.source.scope).toContain('補間補正4178人');
 expect(Object.values(entry.regions).reduce((s,r)=>s+r.populationEnd,0)).toBe(128057352);
 expect(Object.values(entry.regions).reduce((s,r)=>s+r.naturalChange!,0)).toBe(-104701);
 expect(Object.keys(entry.regions).reduce((s,c)=>s+annualResidualMetric(entry,c,data.retrievedAt).value,0)).toBe(130539);
 const $=load(renderToStaticMarkup(<RegionalSnapshotIndicators snapshot={{year:2010,status:'final',groups:{total:{rows:[],migrationChange:value}}}} group="total"/>));
 expect($('.regional-migration-change').text()).toContain('2009.10–10.9 · 残差推計');expect($('.regional-migration-change').text()).not.toContain('平均');expect($('.regional-migration-change strong').text()).toBe('−2,765人');
});
test('2000年は千人を人に換算済みの期首人口と‰を使い最後だけ丸める',async()=>{
 const data=await readAnnualResiduals(),entry=data.entries.find(e=>e.year===2000)!;
 const v=annualResidualMetric(entry,'01',data.retrievedAt);
 expect(v.calculation!.populationStart).toBe(5689000);expect(v.calculation!.populationEnd).toBe(5683000);
 expect(v.calculation!.naturalChange).toBe(2844.5);expect(v.value).toBe(Math.round(-6000-2844.5));expect(v.source.scope).toContain('0.1‰');
 for(const code of Object.keys(entry.regions))expect(Number.isFinite(annualResidualMetric(entry,code,data.retrievedAt).value)).toBe(true);
});
test('自然増減ゼロを欠損扱いせず、年・地域・公表収支の不整合は拒否',async()=>{
 const data=await readAnnualResiduals();const zero=structuredClone(data.entries[0]);zero.regions['01']={populationStart:100,populationEnd:101,naturalChange:0,reportedMigration:1,adjustment:0};expect(annualResidualMetric(zero,'01',data.retrievedAt).value).toBe(1);
 const mismatch=structuredClone(data);mismatch.entries[0].startDate='2010-01-01';expect(()=>annualResidualSchema.parse(mismatch)).toThrow();
 const missing=structuredClone(data);delete missing.entries[0].regions['47'];expect(()=>annualResidualSchema.parse(missing)).toThrow();
 const bad=structuredClone(data);bad.entries[0].regions['01'].naturalChange!++;expect(()=>annualResidualSchema.parse(bad)).toThrow();
});
