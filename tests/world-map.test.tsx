import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {worldMapSchema} from '../src/types/world-map';
import {WorldMapView} from '../src/components/WorldMap';
import {worldGdpData} from '../scripts/sources/world-gdp';
import {MapStatsTooltip} from '../src/components/MapStatsTooltip';
const data=worldMapSchema.parse(JSON.parse(readFileSync('public/maps/world.json','utf8')));
describe('interactive world map',()=>{
 it('contains independent population and area metadata with no duplicate countries',()=>{
  expect(data.countries).toHaveLength(178);
  const japan=data.countries.find(c=>c.code==='JPN')!;
  expect(japan.population).toBe(122427731);expect(japan.areaKm2).toBe(377974.71);expect(japan.areaYear).toBe(2024);
  expect(data.populationDate).toBe('2026-07-01');expect(japan.areaReference).toBe(false);
  for(const c of data.countries)if(c.population!==null&&c.areaKm2!==null)expect(Number.isFinite(c.population/c.areaKm2)).toBe(true);
 });
 it('separates overseas statistical territories and marks inferred areas',()=>{
  for(const code of ['FRA','GUF']){
   const c=data.countries.find(c=>c.code===code)!;
   expect(c.population).toBeGreaterThan(0);expect(c.areaKm2).toBeGreaterThan(0);expect(c.areaReference).toBe(true);
  }
  expect(data.countries.find(c=>c.code==='GUF')?.population).toBeLessThan(1000000);
  expect(data.countries.find(c=>c.code==='CYN')?.population).toBeNull();
  expect(data.countries.find(c=>c.code==='SOL')?.population).toBeNull();
 });
 it('provides keyboard-accessible country buttons and no tooltip until selection',()=>{
  const $=load(renderToStaticMarkup(<WorldMapView data={data}/>));
  expect($('svg path[role=button]')).toHaveLength(data.countries.length);
  expect($('svg path[tabindex="0"]')).toHaveLength(data.countries.length);
  expect($('.municipal-tooltip')).toHaveLength(0);
  expect($('.source-details')).toHaveLength(1);
 });
 it('reuses the municipal tooltip with population, area, density, dates and a close button',()=>{
  const $=load(renderToStaticMarkup(<MapStatsTooltip name="日本" population={122427731} areaKm2={377974.71} populationDate="2026-07-01" areaDate="2024年" populationEstimate closeLabel="国の情報を閉じる" onClose={()=>{}} style={{left:0,top:0}}/>));
  expect($('h4').text()).toBe('日本');expect($('.municipal-population').text()).toBe('122,427,731人');
  expect($('dl').text()).toContain('377,974.71');expect($('dl').text()).toContain('323.9');
  expect($('.municipal-tooltip-date').text()).toContain('2026/07/01');expect($('.municipal-tooltip-date').text()).toContain('2024年');
  expect($('button').attr('aria-label')).toBe('国の情報を閉じる');
 });
 it('does not invent missing population, area or density',()=>{
  const $=load(renderToStaticMarkup(<MapStatsTooltip name="南極大陸" population={null} areaKm2={null} populationDate="2026-07-01" areaDate="データなし" closeLabel="閉じる" onClose={()=>{}} style={{}}/>));
  expect($('.municipal-population').text()).toBe('データなし');
  expect($('dd').map((_,el)=>$(el).text()).get()).toEqual(['データなし','データなし']);
 });
});

it('GDPは国の基準年と同年の世界総額を使い、地図コードを対応させる',()=>{
 const response=(rows:unknown[])=>[{pages:1,lastupdated:'2026-10-08'},rows];
 const row=(code:string,date:string,value:number)=>({indicator:{id:'NY.GDP.MKTP.CD'},countryiso3code:code,date,value});
 const gdp=worldGdpData(response([row('JPN','2024',4),row('PSE','2025',2)]),response([row('WLD','2024',100),row('WLD','2025',120)]));
 expect(gdp.get('JPN')).toEqual({usd:4,year:2024,worldUsd:100});
 expect(gdp.get('PSX')).toEqual({usd:2,year:2025,worldUsd:120});
 expect(gdp.get('TWN')).toBeNull();
 expect(()=>worldGdpData(response([row('JPN','2024',4)]),response([row('WLD','2025',120)])).get('JPN')).toThrow('2024');
});
it('人口密度の下に名目GDPと世界比を表示し、基準年も添える',()=>{
 const japan=data.countries.find(c=>c.code==='JPN')!;
 expect(japan.gdp?.year).toBe(2025);
 const $=load(renderToStaticMarkup(<MapStatsTooltip name="日本" population={japan.population} areaKm2={japan.areaKm2} populationDate={data.populationDate} areaDate="2024年" gdp={japan.gdp} closeLabel="閉じる" onClose={()=>{}} style={{}}/>));
 expect($('dt').map((_,el)=>$(el).text()).get()).toEqual(['面積','人口密度','名目GDP']);
 expect($('dd').last().text()).toBe('4.4兆米ドル（3.7%）');
 expect($('.map-population-share').attr('aria-label')).toBe('世界GDPの3.7%');
 expect($('.municipal-tooltip-date').text()).toContain('GDP 2025年');
});
it('GDP欠損を0と表示せず、世界比も付けない',()=>{
 const $=load(renderToStaticMarkup(<MapStatsTooltip name="地域" population={null} areaKm2={null} populationDate={data.populationDate} areaDate="データなし" gdp={null} closeLabel="閉じる" onClose={()=>{}} style={{}}/>));
 expect($('dd').last().text()).toBe('データなし');
 expect($('.map-population-share')).toHaveLength(0);
});
