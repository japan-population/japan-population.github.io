import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {CENSUS_TABLES,normalizeCensusTable,normalizeAnnualTable,mergeCensusSnapshots} from '../scripts/sources/official-archive';
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
for(const config of CENSUS_TABLES)for(const c of normalizeCensusTable(tables[config.id],config))snapshots.set(c.year,mergeCensusSnapshots(snapshots.get(c.year),c));
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
 expect(officialView(national,'foreign',1920).population).toBe(78061);
 expect(officialView(national,'japanese',2020).population).toBe(121541155);
 for(const g of ['total','japanese','foreign']as const){const view=officialView(national,g,'latest');expect(view.population).toBe(national.breakdown!.groups[g].base);expect(view.rows).toHaveLength(66);}
});
it('スライダーは最新を初期表示、日付はその上、年間欄は総人口・日本人だけで閉じる',async()=>{
 const {national}=await readDataset('public/data');
 for(const group of ['total','japanese','foreign']as const){
  const $=load(renderToStaticMarkup(<PopulationExplorer national={national} group={group} demo={false}/>));
  expect($('input[type=range]').attr('value')).toBe('11');expect($('.timeline-labels button')).toHaveLength(12);
  expect($('.official-date').next().is('input[type=range]')).toBe(true);
  expect($('.section-heading time')).toHaveLength(0);expect($('.official-timeline .official-date time').attr('datetime')).toBe(national.population.baseDate.slice(0,10));
  expect($('.official-pyramid').is('details')).toBe(true);expect($('.official-pyramid').attr('open')).toBeUndefined();
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
it('1980年以降の総人口と2000年以降の日本人は100歳以上まで保持する',async()=>{
 const {national}=await readDataset('public/data');
 for(const [year,total,japanese]of [[1980,989,undefined],[1990,3223,undefined],[2000,12256,12230],[2010,43882,43767],[2020,79523,79327]]as const){
  for(const [group,expected]of [['total',total],['japanese',japanese]]as const){
   if(expected===undefined)continue;
   const actual=archive.censuses.find(c=>c.year===year)!.groups[group]!;
   const rows=actual.rows.filter(r=>r.sex==='男女計');
   expect(rows.filter(r=>r.age==='100歳以上')).toEqual([{group,sex:'男女計',age:'100歳以上',value:expected}]);
   for(const interval of [5,10]as const)expect(pyramidRows(actual.rows,interval)[0].total).toBe(expected);
   expect(officialView(national,group,year).rows).toEqual(actual.rows);
   expect(rows.filter(r=>r.age!=='総数').reduce((s,r)=>s+r.value,0)).toBeLessThanOrEqual(actual.population);
  }
 }
});
it('国籍表の読み込み順序にかかわらず詳細年齢を粗い区分で上書きしない',()=>{
 for(const year of [2010,2020]){
  const fine=archive.censuses.find(c=>c.year===year)!;
  const config=CENSUS_TABLES.find(c=>'year'in c&&c.year===year&&'marker'in c&&c.marker!=='うち日本人'&& !('ageLabel'in c))!;
  const coarse=normalizeCensusTable(tables[config.id],config)[0];
  for(const merged of [mergeCensusSnapshots(fine,coarse),mergeCensusSnapshots(coarse,fine)]){
   expect(merged.groups.total!.rows).toEqual(fine.groups.total!.rows);
   expect(merged.groups.japanese!.rows).toEqual(fine.groups.japanese!.rows);
   expect(merged.groups.foreign!.rows).toEqual(coarse.groups.foreign!.rows);
  }
  const bad=structuredClone(coarse);bad.groups.total!.male++;
  expect(()=>mergeCensusSnapshots(fine,bad)).toThrow('出典間');
 }
});
it('各歳データの欠落・重複を検出し、再掲100歳以上を二重加算しない',()=>{
 const config=CENSUS_TABLES.find(c=>c.id==='0003445133')!;
 const table=structuredClone(tables[config.id]);
 table.values.splice(10,1);expect(()=>normalizeCensusTable(table,config)).toThrow('欠けています');
 const duplicate=structuredClone(tables[config.id]);duplicate.values.push(duplicate.values[10]);
 expect(()=>normalizeCensusTable(duplicate,config)).toThrow('重複');
 const normalized=normalizeCensusTable(tables[config.id],config)[0];
 expect(normalized.groups.total!.rows.filter(r=>r.age==='100歳以上'&&r.sex==='男女計').map(r=>r.value)).toEqual([79523]);
});
it('原表PDFで補完した1920・1930・1950・1970年は85歳以上の男女別合計を維持する',async()=>{
 const {supplementCensusAges}=await import('../scripts/sources/census-age-supplements');
 const fine=await supplementCensusAges(structuredClone(archive.censuses));
 const {national}=await readDataset('public/data');
 for(const [year,count]of [[1920,113],[1930,105],[1950,97],[1970,329]]as const){
  const group=fine.find(c=>c.year===year)!.groups.total!;
  expect(pyramidRows(group.rows,5)[0].total).toBe(count);
  expect(pyramidRows(group.rows,10)[0].total).toBe(count);
  expect(officialView(national,'total',year).rows).toEqual(group.rows);
  expect(officialView(national,'total',year).ageSource?.url).toContain('file-download');
  const old=archive.censuses.find(c=>c.year===year)!.groups.total!;
  for(const sex of ['男女計','男','女'])expect(group.rows.filter(r=>r.sex===sex).reduce((s,r)=>s+r.value,0)).toBe(old.rows.filter(r=>r.sex===sex).reduce((s,r)=>s+r.value,0));
 }
 const bad=structuredClone(archive.censuses);bad[0].groups.total!.rows.find(r=>r.age==='85歳以上'&&r.sex==='男')!.value++;
 await expect(supplementCensusAges(bad)).rejects.toThrow('一致しません');
});

it('1940・1960年は85歳以上を沖縄を除く4階級に分けて注記する',async()=>{
 const {supplementCensusAges}=await import('../scripts/sources/census-age-supplements');
 const {PopulationPyramid}=await import('../src/components/PopulationPyramid');
 const fine=await supplementCensusAges(structuredClone(archive.censuses));
 const {national}=await readDataset('public/data');
 for(const [year,total,male,female]of [[1940,185,26,159],[1960,144,27,117]]){
  const group=fine.find(c=>c.year===year)!.groups.total!;
  const original=archive.censuses.find(c=>c.year===year)!.groups.total!;
  expect(group.rows.filter(r=>!(parseInt(r.age)>=85))).toEqual(original.rows.filter(r=>!(parseInt(r.age)>=85)));
  expect(group.population).toBe(original.population);
  expect(group.ageExclusion).toMatchObject({fromAge:85,scopeLabel:'沖縄を除く'});
  for(const [sex,key]of [['男女計','total'],['男','male'],['女','female']]as const){
   expect(group.rows.filter(r=>r.sex===sex&&parseInt(r.age)>=85).reduce((n,r)=>n+r.value,0)+group.ageExclusion!.omitted[key]).toBe(original.rows.find(r=>r.sex===sex&&r.age==='85歳以上')!.value);
  }
  expect(officialView(national,'total',year).rows).toEqual(group.rows);
  expect(officialView(national,'japanese',year).ageExclusion).toBeUndefined();
  expect(officialView(national,'foreign',year).ageExclusion).toBeUndefined();
  for(const interval of [5,10]as const){
   const rows=pyramidRows(group.rows,interval);
   expect(rows[0]).toMatchObject({age:'100歳以上',total,male,female});
   expect(rows.find(r=>r.age===(interval===5?'85～89歳':'80～89歳'))).toBeDefined();
   const $=load(renderToStaticMarkup(<PopulationPyramid rows={group.rows} label="総人口" interval={interval} onIntervalChange={()=>{}} historical ageExclusion={group.ageExclusion}/>));
   expect($('.age-label sup')).toHaveLength(interval===5?4:3);
   expect($('.age-label').filter((_,e)=>$(e).text()==='80～84歳').find('sup')).toHaveLength(0);
   expect($('.small-note').last().text()).toBe('※85歳以上は沖縄のデータを含まない値です');
   expect($('.small-note').last().prev().text()).toBe('年齢不詳はグラフに含めていません。');
  }
 }
 expect(await supplementCensusAges(structuredClone(fine))).toEqual(fine);
});
it('1950年は琉球・奄美の原表を合算し出典と基準日を保持する',async()=>{
 const {national}=await readDataset('public/data');
 const view=officialView(national,'total',1950);
 expect(pyramidRows(view.rows,5)[0]).toMatchObject({age:'100歳以上',total:97,male:25,female:72});
 expect(view.ageExclusion).toBeUndefined();
 expect(view.ageSupportingSources).toHaveLength(1);
 expect(view.ageSupportingSources![0].sourcePeriod).toBe('1950-12');
 expect(view.ageSupportingSources![0].scope).toContain('奄美');
 for(const [sex,count]of [['男女計',96512],['男',29003],['女',67509]]as const)
  expect(view.rows.filter(r=>r.sex===sex&&parseInt(r.age)>=85).reduce((n,r)=>n+r.value,0)).toBe(count);
});
