import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {normalizeEventBreakdowns,fiveYearAge,breakdownFilters} from '../scripts/sources/event-breakdowns';
import {addHistoricalEventBreakdowns} from '../scripts/sources/historical-event-breakdowns';
import {breakdownCount,realtimeEventBreakdowns,selectEventBreakdowns} from '../src/lib/event-breakdowns';
import {eventBreakdownsSchema,type AnnualOfficial} from '../src/types/statistics';
import {EventBreakdown} from '../src/components/EventBreakdown';
import {EventCounter} from '../src/components/EventCounter';
import type {Table} from '../scripts/sources/table';
const tables:Record<string,Table>=JSON.parse(readFileSync('tests/fixtures/event-breakdown-tables.json','utf8'));
const annual:AnnualOfficial[]=JSON.parse(readFileSync('public/data/national.json','utf8')).archive.annual;
const data=normalizeEventBreakdowns(tables,annual);
const get=(year:number,event:'birth'|'death'|'marriage'|'divorce',kind:string)=>data.find(s=>s.year===year&&s.event===event&&s.kind===kind)!;

describe('公表内訳の正規化',()=>{
 it('別の公的資料から補った年齢内訳は原表の範囲を保ち、年総数を変えない',()=>{
   for(const kind of ['husbandAge','wifeAge']){
     const old=get(1920,'marriage',kind);expect(old.items.reduce((n,i)=>n+i.count,0)).toBe(546207);
     expect(old.items.some(i=>i.label==='40～49歳')).toBe(true);expect(old.ageGrouping).toBe('published');
     expect(get(1930,'divorce',kind).items.reduce((n,i)=>n+i.count,0)).toBe(51259);
   }
   expect(get(1930,'marriage','husbandAge').items.reduce((n,i)=>n+i.count,0)).toBe(505868);
   expect(get(1930,'marriage','wifeAge').items.reduce((n,i)=>n+i.count,0)).toBe(505652);
   expect(get(1930,'marriage','wifeAge').total).toBe(506674);
   expect(get(1930,'marriage','wifeAge').coverage).toBe('partial');
   expect(get(1930,'divorce','wifeAge').items.find(i=>i.label==='20～24歳')?.count).toBe(14685);
 });
 it('他殺は人口動態の男女計を使い、未確認の交通事故をゼロ補完しない',()=>{
   for(const [year,count] of [[1950,1883],[1980,1113],[1990,744]]){
     const s=get(year,'death','cause');expect(s.items.find(i=>i.label==='他殺')).toMatchObject({count,supplement:true});
     expect(s.additionalSources?.some(source=>source.url.includes(year===1950?'tmiph.metro.tokyo.lg.jp':'000027399554'))).toBe(true);
   }
   expect(get(1930,'death','cause').items.some(i=>i.label==='交通事故')).toBe(false);
   expect(selectEventBreakdowns(data,'marriage','japanese',1940)).toEqual([]);
 });
 it('更新処理は補足を重複させず、APIから取得できた既存値を優先する',()=>{
   const before=structuredClone(data);expect(addHistoricalEventBreakdowns(data,annual)).toEqual(data);expect(data).toEqual(before);
   const preferred=structuredClone(data);preferred.find(s=>s.year===1980&&s.kind==='cause')!.items.find(i=>i.label==='他殺')!.count=1234;
   expect(addHistoricalEventBreakdowns(preferred,annual).find(s=>s.year===1980&&s.kind==='cause')!.items.find(i=>i.label==='他殺')!.count).toBe(1234);
   expect(addHistoricalEventBreakdowns([],[])).toEqual([]);
 });
 it('最新年は全4指標が揃い、年齢・出生順位は不詳を含め総数に一致する',()=>{
   for(const s of data.filter(s=>s.year===2024&&s.kind!=='cause'))expect(s.items.reduce((n,i)=>n+i.count,0)).toBe(s.total);
   expect(data.filter(s=>s.year===2024)).toHaveLength(8);
   expect(get(2024,'birth','motherAge').total).toBe(686173);
   expect(get(2024,'death','deathAge').total).toBe(1605378);
   expect(get(2024,'marriage','husbandAge').total).toBe(485092);
   expect(get(2024,'divorce','wifeAge').total).toBe(185904);
 });
 it('母の年齢・出生順位は死産を含む出産順位と混同しない',()=>{
   expect(get(2024,'birth','birthOrder').items.map(i=>i.label)).toEqual(['第1子','第2子','第3子','第4子','第5子以上','不詳']);
   expect(get(1950,'birth','motherAge').items).toHaveLength(10);
 });
 it('生年年齢の2コホートを合算し5歳階級へまとめる',()=>{
   expect(fiveYearAge('調査年の25年前生・24歳')).toBe('20～24歳');
   expect(fiveYearAge('調査年の24年前生・24歳')).toBe('20～24歳');
   expect(fiveYearAge('２５～２９歳')).toBe('25～29歳');
   expect(fiveYearAge('調査年の80年前生・80歳')).toBe('80歳以上');
   expect(fiveYearAge('平均婚姻年齢')).toBeNull();
 });
 it('最新死因の順位を保ち、追加3項目は重複しない',()=>{
   const s=get(2024,'death','cause');expect(s.items.filter(i=>i.rank)).toHaveLength(10);
   expect(s.items[0]).toMatchObject({rank:1,count:384111});
   expect(s.items.find(i=>i.label==='他殺')).toMatchObject({count:222,supplement:true});
   expect(s.items.find(i=>i.label==='交通事故')?.count).toBe(3511);
   const old=get(1980,'death','cause');expect(old.items[0].label).toBe('脳血管疾患');
   expect(old.items.filter(i=>i.label==='自殺')).toHaveLength(1);
   expect(old.items.find(i=>i.label==='自殺')?.supplement).toBeUndefined();
 });
 it('戦前は公式の上位5位までとし、死亡率から算出した数を参考値で区別する',()=>{
   const s=get(1920,'death','cause');expect(s.items.filter(i=>i.rank)).toHaveLength(5);
   expect(s.items[0]).toMatchObject({label:'肺炎及び気管支炎',approximate:true});
   expect(s.items.find(i=>i.label==='脳血管疾患')?.approximate).toBe(false);
   expect(s.additionalSources?.[0].url).toContain('0003411656');
 });
 it('過去婚姻・離婚の部分集計は全件へ拡大しない',()=>{
   const s=get(2010,'marriage','husbandAge');expect(s.coverage).toBe('partial');
   expect(s.items.reduce((n,i)=>n+i.count,0)).toBe(584086);expect(s.total).toBe(700222);
   expect(s.note).toContain('当年に結婚生活');
   expect(selectEventBreakdowns(data,'birth','japanese',1920)).toEqual([]);
 });
 it('年齢行の欠落と二重計上を検出する',()=>{
   const broken=structuredClone(tables);broken['0003411599'].values=broken['0003411599'].values.filter(v=>v['@cat01']!=='00140');
   expect(()=>normalizeEventBreakdowns(broken,annual)).toThrow('年齢区分の欠損');
   const s=structuredClone(get(2024,'birth','birthOrder'));s.items.push(s.items[0]);
   expect(eventBreakdownsSchema.safeParse([s]).success).toBe(false);
 });
 it('API条件は総数・年総計を選び、月や初婚再婚を二重計上しない',()=>{
   expect(breakdownFilters('0003411951',tables['0003411951'].classes).cdCat01).toBe('00100');
   expect(breakdownFilters('0003411840',tables['0003411840'].classes).cdCat03).toBeUndefined();
   expect(breakdownFilters('0003411661',tables['0003411661'].classes)).toMatchObject({cdTab:'10100',cdCat03:'00100',cdCat04:'00100'});
 });
});
describe('リアルタイム配分と表示',()=>{
 it('戦前の公表年齢区分を5歳階級と誤表示せず、補足値と出典を描画する',()=>{
   const html=renderToStaticMarkup(<EventBreakdown event="marriage" sections={selectEventBreakdowns(data,'marriage','japanese',1920)}/>);
   expect(load(html)('.breakdown-category > summary small')).toHaveLength(0);expect(html).not.toContain('5歳階級');expect(html).toContain('40～49歳');
   const $=load(renderToStaticMarkup(<EventBreakdown event="death" sections={selectEventBreakdowns(data,'death','japanese',1990)}/>));
   expect($('tr').filter((_,row)=>$(row).find('th').text()==='他殺').text()).toContain('744人');
   expect($('a[href*="000027399554"]')).toHaveLength(1);
 });
 it('死因の割合は上位10項目合計でなく死亡総数を分母にする',()=>{
   const s=get(2024,'death','cause'),v=breakdownCount(s,384111,10000);
   expect(v.percent).toBeCloseTo(384111/1605378*100,8);expect(v.count).toBe(2392);
 });
 it('日・月・年の表示数に連動し、ゼロでもNaNを出さない',()=>{
   const s=get(2024,'birth','motherAge');for(const total of [0,123,12000,580000]){
     const values=s.items.map(i=>breakdownCount(s,i.count,total));
     expect(values.reduce((n,v)=>n+v.count,0)).toBeLessThanOrEqual(total);
     expect(values.every(v=>Number.isFinite(v.count)&&Number.isFinite(v.percent))).toBe(true);
   }
   expect(breakdownCount({...s,total:0},0,0)).toEqual({count:0,percent:0});
 });
 it('日本人の代用を明示し、外国人の婚姻・離婚へは流用しない',()=>{
   expect(realtimeEventBreakdowns(data,'birth','total').proxy).toBe(true);
   expect(realtimeEventBreakdowns(data,'birth','foreign').proxy).toBe(true);
   expect(realtimeEventBreakdowns(data,'birth','japanese').proxy).toBe(false);
   expect(realtimeEventBreakdowns(data,'marriage','total').proxy).toBe(false);
   expect(realtimeEventBreakdowns(data,'marriage','foreign').sections).toEqual([]);
 });
 it('カード内は閉じたアコーディオン、割合と推計人数を表示する',()=>{
   const sections=selectEventBreakdowns(data,'birth','japanese');
   const html=renderToStaticMarkup(<EventBreakdown event="birth" sections={sections} total={10000} proxy/>),$=load(html);
   expect($('details').attr('open')).toBeUndefined();expect($('details.event-breakdown')).toHaveLength(0);expect(html).not.toContain('内訳を見る');
   expect(html).toContain('参考推計');expect($('.breakdown-category')).toHaveLength(2);
   expect($('.breakdown-table tbody tr')).toHaveLength(16);
   expect($('details.breakdown-category')).toHaveLength(2);
   expect($('.breakdown-category[open]')).toHaveLength(0);
   expect($('.breakdown-category > summary').text()).not.toContain('2024年');
   expect($('.source-details > summary').text()).not.toContain('2024年');
   expect(html).toContain('全体比');
   const historical=load(renderToStaticMarkup(<EventBreakdown event="birth" sections={sections}/>));
   expect(historical('.breakdown-category > summary small')).toHaveLength(0);
   expect($('.breakdown-category > summary small')).toHaveLength(0);
   const empty=renderToStaticMarkup(<EventBreakdown event="birth" sections={[]}/>);expect(load(empty)('.breakdown-note').first().text()).toBe('—');
 });
 it('各期間の既存カウンターと同じ値を内訳へ渡す',()=>{
   const sections=selectEventBreakdowns(data,'birth','japanese');
   const estimate={day:1000,month:20000,year:300000,dailyTarget:2000,ratePerSecond:1};
   for(const period of ['day','month','year'] as const){
     const $=load(renderToStaticMarkup(<EventCounter kind="birth" month="2026-10" now={0} period={period} officialLabel="公式確定値" estimate={estimate} breakdowns={sections}/>));
     const s=sections.find(s=>s.kind==='birthOrder')!;
     expect($('.breakdown-table').first().find('tbody tr').first().find('td').first().text()).toBe(`${breakdownCount(s,s.items[0].count,estimate[period]).count.toLocaleString('ja-JP')}人`);
   }
 });
});
it('最新年で不足する内訳だけ前年の原値を年付きで表示する',()=>{
 const sections=selectEventBreakdowns(data,'marriage','japanese',2025,true);
 expect(sections).toHaveLength(2);expect(sections.every(s=>s.year===2024)).toBe(true);
 expect(sections[0].total).toBe(485092);
 const html=renderToStaticMarkup(<EventBreakdown event="marriage" sections={sections} referenceYear={2025}/>);
 expect(load(html)('.breakdown-category > summary small').map((_,el)=>load(html)(el).text()).get()).toEqual(['2024年','2024年']);expect(html).not.toContain('未収録');
 expect(selectEventBreakdowns(data,'marriage','japanese',1940)).toEqual([]);
});
it('交通事故は不慮の事故の閉じた内訳内にだけ表示する',()=>{
 const section=get(2024,'death','cause');
 const $=load(renderToStaticMarkup(<EventBreakdown event="death" sections={[section]} total={10000}/>));
 expect($('.cause-details[data-cause=accident]')).toHaveLength(1);expect($('.cause-details[data-cause=accident]').attr('open')).toBeUndefined();
 expect($('.cause-details[data-cause=accident] .cause-table tbody tr')).toHaveLength(7);
 expect($('.cause-details[data-cause=accident] .cause-table').text()).toContain('交通事故');
 expect($('.breakdown-category > .breakdown-table > tbody > tr > th').text()).not.toContain('交通事故');
 const children=section.items.find(i=>i.label==='不慮の事故')!.children!;
 expect(children.reduce((n,i)=>n+i.count,0)).toBe(45743);
 expect($('.cause-details[data-cause=accident] .cause-table tr').first().text()).toContain(`${Math.floor(10000*3511/1605378)}人`);
});

it('がんの全21分類を閉じた内訳で表示し、死亡総数に対する割合で推計する',()=>{
 const section=get(2024,'death','cause'),cancer=section.items.find(i=>i.label.startsWith('悪性新生物'))!;
 expect(cancer.children).toHaveLength(21);
 expect(cancer.children!.reduce((n,i)=>n+i.count,0)).toBe(cancer.count);
 for(const total of [undefined,10000]){
  const $=load(renderToStaticMarkup(<EventBreakdown event="death" sections={[section]} total={total}/>));
  const detail=$('.cause-details[data-cause=cancer]');
  expect(detail.attr('open')).toBeUndefined();expect(detail.find('tbody tr')).toHaveLength(21);
  const child=cancer.children![0],row=detail.find('tbody tr').first();
  expect(row.find('td').first().text()).toBe(`${(total===undefined?child.count:Math.floor(total*child.count/section.total)).toLocaleString('ja-JP')}人`);
  expect(row.find('td').last().text()).toBe(`${(child.count/section.total*100).toFixed(1)}%`);
 }
});
