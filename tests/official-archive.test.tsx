import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {CENSUS_TABLES,normalizeCensusTable,normalizeAnnualTable} from '../scripts/sources/official-archive';
import type {Table} from '../scripts/sources/table';
import {CENSUS_YEARS,officialArchiveSchema,type CensusSnapshot} from '../src/types/statistics';
import {readDataset} from '../scripts/dataset';
import {validatePublication} from '../scripts/validation';
import {officialView} from '../src/lib/official-view';
import {pyramidRows} from '../src/lib/pyramid';
import {PopulationExplorer} from '../src/components/PopulationExplorer';
import {AnnualVital} from '../src/components/AnnualVital';
const tables=JSON.parse(await readFile('tests/fixtures/official-archive-tables.json','utf8')) as Record<string,Table>;
const snapshots=new Map<number,CensusSnapshot>();
for(const config of CENSUS_TABLES)for(const c of normalizeCensusTable(tables[config.id],config))snapshots.set(c.year,{...c,groups:{...snapshots.get(c.year)?.groups,...c.groups}});
const archive=officialArchiveSchema.parse({censuses:[...snapshots.values()],annual:normalizeAnnualTable(tables['0003411561'])});
it('11回の国勢調査の実数と国籍不詳を分離して保持する',()=>{
 expect(archive.censuses.map(c=>c.year)).toEqual(CENSUS_YEARS);
 expect(archive.censuses[0].groups.total!.population).toBe(55963053);
 expect(archive.censuses[0].groups.total!.male).toBe(28044185);
 const last=archive.censuses.at(-1)!;
 expect(last.groups.total!.population).toBe(126146099);
 expect(last.groups.foreign!.population).toBe(2402460);
 expect(last.groups.japanese!.population+last.groups.foreign!.population).toBeLessThan(last.groups.total!.population);
 expect(archive.censuses[0].groups.japanese).toBeUndefined();
 expect(archive.censuses.find(c=>c.year===2000)!.groups.foreign).toBeUndefined();
});
it('85歳以上を85～89歳と誤表示せず、10歳切替後も合計を維持する',()=>{
 const rows=archive.censuses[0].groups.total!.rows;
 const five=pyramidRows(rows,5),ten=pyramidRows(rows,10);
 expect(five[0].age).toBe('85歳以上');expect(ten[0].age).toBe('80歳以上');
 expect(ten[0].total).toBe(five[0].total+five[1].total);
 for(const sex of ['male','female','total']as const)expect(ten.reduce((s,r)=>s+r[sex],0)).toBe(five.reduce((s,r)=>s+r[sex],0));
});
it('年・性別・年齢階級の欠損と重複を拒否する',()=>{
 const bad=structuredClone(archive);bad.censuses.pop();expect(()=>officialArchiveSchema.parse(bad)).toThrow();
 const missing=structuredClone(archive);missing.censuses[0].groups.total!.rows=missing.censuses[0].groups.total!.rows.filter(r=>r.sex!=='男');expect(()=>officialArchiveSchema.parse(missing)).toThrow();
 const raw=structuredClone(tables['0003410380']);raw.values.push(raw.values[0]);expect(()=>normalizeCensusTable(raw,CENSUS_TABLES[0])).toThrow('重複');
 const missingAnnual=structuredClone(archive);delete (missingAnnual.annual[0].counts as Partial<typeof missingAnnual.annual[0]['counts']>).birth;expect(()=>officialArchiveSchema.parse(missingAnnual)).toThrow();
});
it('年間実績を月間推計へ置換せず、選択年に連動する',async()=>{
 const {national}=await readDataset('public/data');
 for(const year of CENSUS_YEARS){const view=officialView(national,'total',year);expect(view.date).toBe(`${year}-10-01`);expect(view.annual!.year).toBe(year);expect(view.population).toBeDefined();expect(view.rows.length).toBeGreaterThan(0);}
 expect(officialView(national,'total',1920).annual!.counts).toEqual({birth:2025564,death:1422096,marriage:546207,divorce:55511});
 expect(officialView(national,'total',2020).annual!.counts.birth).toBe(840835);
 expect(officialView(national,'foreign',1920).population).toBeUndefined();
 expect(officialView(national,'japanese',2020).population).toBe(121541155);
 for(const g of ['total','japanese','foreign']as const){const view=officialView(national,g,'latest');expect(view.population).toBe(national.breakdown!.groups[g].base);expect(view.rows).toHaveLength(66);}
});
it('スライダーは最新を初期表示、日付はその下、年間欄は総人口・日本人だけで閉じる',async()=>{
 const {national}=await readDataset('public/data');
 for(const group of ['total','japanese','foreign']as const){
  const $=load(renderToStaticMarkup(<PopulationExplorer national={national} group={group} demo={false}/>));
  expect($('input[type=range]').attr('value')).toBe('11');expect($('.timeline-labels button')).toHaveLength(12);
  expect($('.section-heading time')).toHaveLength(0);expect($('.official-timeline .official-date time').attr('datetime')).toBe(national.population.baseDate.slice(0,10));
  expect($('.annual-vital').length).toBe(group==='foreign'?0:1);expect($('.annual-vital').attr('open')).toBeUndefined();
  if(group==='total')expect($('.annual-vital').text()).toContain('出生・死亡・婚姻・離婚は日本人のみ');
 }
 const html=renderToStaticMarkup(<AnnualVital data={archive.annual[0]} total latest={false}/>);
 expect(html).toContain('1920');expect(html).toContain('2,025,564');expect(html).not.toContain('推計');
});
it('過去統計の欠落は公開検証で検出する',async()=>{
 const d=await readDataset('public/data');delete d.national.archive;
 expect(()=>validatePublication(d)).toThrow('過去国勢調査');
});
