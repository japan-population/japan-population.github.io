import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import type {Table} from '../scripts/sources/table';
import {normalizeJapaneseReference,addHistoricalNationalities,normalize2020Nationalities} from '../scripts/sources/historical-nationalities';
import {readDataset} from '../scripts/dataset';
import {officialArchiveSchema} from '../src/types/statistics';
import {officialView} from '../src/lib/official-view';
import {validatePublication,validateChange} from '../scripts/validation';
const tables=JSON.parse(await readFile('tests/fixtures/historical-nationalities-tables.json','utf8')) as Record<string,Table>;
const html=await readFile('tests/fixtures/historical-japanese.html','utf8');
const now=Date.parse('2026-10-02T00:00:00+09:00');
const reference=normalizeJapaneseReference(html,now);
it('日本人の参考値は公表概数・対象範囲を保持し、丸め誤差だけ許容する',async()=>{
 expect(reference.get(1920)!.population).toBe(55885000);
 expect(reference.get(1940)!.population).toBe(70629000);
 expect(reference.get(1940)!.male+reference.get(1940)!.female).toBe(70628000);
 expect(reference.get(1950)!.referenceNote).toContain('沖縄県を含みません');
 const {national}=await readDataset('public/data');
 const archive=structuredClone(national.archive!);
 archive.censuses[2].groups.japanese!.female+=2000;
 expect(()=>officialArchiveSchema.parse(archive)).not.toThrow(); // 1,000人単位の個別丸めによる±1,000人のみ許容
 archive.censuses[2].groups.japanese!.female+=2000;
 expect(()=>officialArchiveSchema.parse(archive)).toThrow();
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
 const result=addHistoricalNationalities(snapshots,tables['0003414213'],reference,normalize2020Nationalities(tables['0003445217']));
 expect(result.at(-1)!.groups).toEqual(original!.groups);
 expect(result[0].groups.japanese!.population).toBe(55885000);
 expect(result[9].groups.foreign!.rows.length).toBeGreaterThan(0);
 expect(result[10].nationalities!.items).toHaveLength(35);
 const unknown=original!.groups.total!.population-original!.groups.japanese!.population-original!.groups.foreign!.population;
 expect(unknown).toBeGreaterThan(0); // 国籍不詳を外国人へ振り替えない
});
it('欠損・重複・単位変更・外国人総数の不一致を拒否する',async()=>{
 const {national}=await readDataset('public/data');
 const latest=normalize2020Nationalities(tables['0003445217']);
 const run=(table:Table)=>addHistoricalNationalities(structuredClone(national.archive!.censuses),table,reference,latest);
 const missing=structuredClone(tables['0003414213']);missing.values=[];expect(()=>run(missing)).toThrow();
 const duplicate=structuredClone(tables['0003414213']);duplicate.values.push(duplicate.values[0]);expect(()=>run(duplicate)).toThrow('重複');
 const unit=structuredClone(tables['0003414213']);unit.values[0]['@unit']='千人';expect(()=>run(unit)).toThrow('単位');
 const latestDuplicate=structuredClone(tables['0003445217']);latestDuplicate.values.push(latestDuplicate.values[0]);expect(()=>normalize2020Nationalities(latestDuplicate)).toThrow('重複');
 expect(()=>normalizeJapaneseReference(html.replace('55,885','不明'),now)).toThrow();
});
it('公開時の全期間カバレッジと国籍内訳の基準日を検証する',async()=>{
 const data=await readDataset('public/data'),bad=structuredClone(data);
 delete bad.national.archive!.censuses[0].nationalities;
 expect(()=>validatePublication(bad)).toThrow('過去の国籍別');expect(()=>validateChange(data,bad)).toThrow('国籍内訳');
 const archive=structuredClone(data.national.archive!);archive.censuses[0].nationalities!.source.sourcePeriod='1930-10';
 expect(()=>officialArchiveSchema.parse(archive)).toThrow('基準年');
});
