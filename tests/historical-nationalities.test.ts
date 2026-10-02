import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import type {Table} from '../scripts/sources/table';
import {deriveHistoricalJapanese,addHistoricalNationalities,normalize2020Nationalities} from '../scripts/sources/historical-nationalities';
import {readDataset} from '../scripts/dataset';
import {officialArchiveSchema} from '../src/types/statistics';
import {officialView} from '../src/lib/official-view';
import {validatePublication,validateChange} from '../scripts/validation';
const tables=JSON.parse(await readFile('tests/fixtures/historical-nationalities-tables.json','utf8')) as Record<string,Table>;
it('1990年以前の日本人参考推計は男女別も総人口−外国人と一致する',async()=>{
 const {national}=await readDataset('public/data');
 for(const c of national.archive!.censuses.filter(c=>c.year<=1990)){
  const p=c.groups.japanese!,t=c.groups.total!,f=c.groups.foreign!;
  for(const key of ['population','male','female']as const)expect(p[key]).toBe(t[key]-f[key]);
  expect(p.derivation?.method).toBe('total-minus-foreign');expect(p.referenceNote).toContain('国籍不詳を含みます');
 }
 expect(national.archive!.censuses[0].groups.japanese!.population).toBe(55884992);
 expect(national.archive!.censuses[7].groups.japanese!.population).toBe(122724770);
 const bad=structuredClone(national.archive!);bad.censuses[0].groups.japanese!.population++;
 expect(()=>officialArchiveSchema.parse(bad)).toThrow();
 const missing=structuredClone(national.archive!.censuses[0]);delete missing.groups.foreign;
 expect(()=>deriveHistoricalJapanese(missing)).toThrow();
});
it('全スライダー位置で国籍別人口・国籍内訳を選べ、未公表の年齢構成は捏造しない',async()=>{
 const {national}=await readDataset('public/data');
 for(const year of [...national.archive!.censuses.map(c=>c.year),'latest']as const){
  for(const group of ['total','japanese','foreign']as const)expect(officialView(national,group,year).population).toBeGreaterThan(0);
  const view=officialView(national,'foreign',year);expect(view.nationalities).toBeDefined();
  const n=view.nationalities!;expect(n.items.reduce((sum,i)=>sum+i.value,0)).toBe(n.total);
 }
 expect(officialView(national,'foreign',1920).rows).toHaveLength(0);
 expect(officialView(national,'japanese',1920).referenceNote).toBeDefined();
 expect(officialView(national,'foreign',1920).population).toBe(78061);
 expect(officialView(national,'foreign',1920).nationalities!.items.find(i=>i.name==='韓国・朝鮮')!.value).toBe(40755);
 expect(officialView(national,'foreign',1990).population).toBe(886397);
 expect(officialView(national,'foreign',2020).population).toBe(2402460);
});
it('取得データを再正規化しても既存の正確な人口・年齢内訳を保持する',async()=>{
 const {national}=await readDataset('public/data');
 const snapshots=structuredClone(national.archive!.censuses);
 const original=structuredClone(snapshots.at(-1));
 for(const c of snapshots)if(c.year<2000)delete c.groups.japanese;
 const result=addHistoricalNationalities(snapshots,tables['0003414213'],normalize2020Nationalities(tables['0003445217']));
 expect(result.at(-1)!.groups).toEqual(original!.groups);
 expect(result[0].groups.japanese!.population).toBe(55884992);
 expect(result[9].groups.foreign!.rows.length).toBeGreaterThan(0);
 expect(result[10].nationalities!.items).toHaveLength(35);
 const unknown=original!.groups.total!.population-original!.groups.japanese!.population-original!.groups.foreign!.population;
 expect(unknown).toBeGreaterThan(0); // 国籍不詳を外国人へ振り替えない
});
it('欠損・重複・単位変更・外国人総数の不一致を拒否する',async()=>{
 const {national}=await readDataset('public/data');
 const latest=normalize2020Nationalities(tables['0003445217']);
 const run=(table:Table)=>addHistoricalNationalities(structuredClone(national.archive!.censuses),table,latest);
 const missing=structuredClone(tables['0003414213']);missing.values=[];expect(()=>run(missing)).toThrow();
 const duplicate=structuredClone(tables['0003414213']);duplicate.values.push(duplicate.values[0]);expect(()=>run(duplicate)).toThrow('重複');
 const unit=structuredClone(tables['0003414213']);unit.values[0]['@unit']='千人';expect(()=>run(unit)).toThrow('単位');
 const latestDuplicate=structuredClone(tables['0003445217']);latestDuplicate.values.push(latestDuplicate.values[0]);expect(()=>normalize2020Nationalities(latestDuplicate)).toThrow('重複');
});
it('公開時の全期間カバレッジと国籍内訳の基準日を検証する',async()=>{
 const data=await readDataset('public/data'),bad=structuredClone(data);
 delete bad.national.archive!.censuses[0].nationalities;
 expect(()=>validatePublication(bad)).toThrow('過去の国籍別');expect(()=>validateChange(data,bad)).toThrow('国籍内訳');
 const archive=structuredClone(data.national.archive!);archive.censuses[0].nationalities!.source.sourcePeriod='1930-10';
 expect(()=>officialArchiveSchema.parse(archive)).toThrow('基準年');
});
