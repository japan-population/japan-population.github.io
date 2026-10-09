import {mapScale} from '../src/lib/map-viewport';
import {readFile} from 'node:fs/promises';
import {beforeAll,expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {PREFECTURES} from '../src/lib/prefectures';
import {municipalityMapSchema,type MunicipalityMapData} from '../src/types/municipalities';
import {readMunicipalPopulation,readMunicipalAreas} from '../scripts/sources/municipalities';
let pages:MunicipalityMapData[];
let population:Awaited<ReturnType<typeof readMunicipalPopulation>>;
let area:ReturnType<typeof readMunicipalAreas>;
beforeAll(async()=>{
 pages=await Promise.all(PREFECTURES.map(async p=>municipalityMapSchema.parse(JSON.parse(await readFile(`public/maps/municipalities/${p.code}.json`,'utf8')))));
 population=await readMunicipalPopulation(await readFile('tests/fixtures/municipal-population-2026.xlsx'));
 area=readMunicipalAreas(await readFile('tests/fixtures/municipal-area-2026.csv'));
});
it('全国1741市区町村を収録し、47都道府県それぞれで公表人口の総計に一致する',()=>{
 expect(pages.flatMap(p=>p.municipalities)).toHaveLength(1741);
 for(const p of pages){expect(p.municipalities.reduce((sum,m)=>sum+m.population,0)).toBe(population.get(p.prefectureCode+'000')!.population);}
});
it('全市区町村の人口・面積をコードで公式原表と照合し密度が有限になる',()=>{
 for(const p of pages)for(const m of p.municipalities){expect(m.population).toBe(population.get(m.code)!.population);expect(m.areaKm2).toBe(area.get(m.code)!.areaKm2);expect(m.areaReference).toBe(area.get(m.code)!.areaReference);expect(Number.isFinite(m.population/m.areaKm2)).toBe(true);}
});
it('政令市の区を二重計上せず、東京都23区はそれぞれ表示する',()=>{
 const hokkaido=pages[0];expect(hokkaido.municipalities.find(m=>m.code==='01100')?.population).toBe(1954588);expect(hokkaido.municipalities.some(m=>m.code==='01101')).toBe(false);
 const tokyo=pages[12];expect(tokyo.municipalities.filter(m=>m.code.startsWith('131'))).toHaveLength(23);expect(tokyo.municipalities).toHaveLength(62);
 expect(tokyo.municipalities.some(m=>m.code==='13000')).toBe(false);
});
it('離島の市町村を欠落させず、未把握の北方地域を0人と表示しない',()=>{
 const tokyo=pages[12];expect(tokyo.panels).toHaveLength(3);expect(tokyo.panels.find(p=>p.label==='小笠原諸島')?.paths.map(p=>p.code)).toContain('13421');
 expect(pages[46].panels).toHaveLength(4);expect(pages[0].municipalities.some(m=>m.code==='01695')).toBe(false);
 for(const p of pages){expect(new Set(p.panels.flatMap(p=>p.paths.map(p=>p.code)))).toEqual(new Set(p.municipalities.map(m=>m.code)));}
});
it('性別不詳がある場合も総計の公表人口を保持する',()=>{
 expect(population.get('13103')!.population).toBe(269877);
});
it('地図の人口・面積基準日とライセンスが揃い、一都道府県のJSONは500KB以内',async()=>{
 for(const p of pages){expect(p.populationDate).toBe('2026-01-01');expect(p.areaDate).toBe('2026-07-01');expect(p.boundary.license).toBe('https://creativecommons.org/licenses/by/4.0/');expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThan(500000);}
});
it('表構造・年の変化や男女計を下回る総計を拒否する',async()=>{
 const w=new ExcelJS.Workbook();await w.xlsx.readFile('tests/fixtures/municipal-population-2026.xlsx');w.worksheets[0].getCell('F9').value=1;
 await expect(readMunicipalPopulation(await w.xlsx.writeBuffer() as unknown as Uint8Array)).rejects.toThrow('総計');
 expect(()=>readMunicipalAreas(new TextEncoder().encode('標準地域コード,都道府県,郡,市区町村,令和7年7月1日(k㎡)'))).toThrow('年月');
});

it('小笠原の初期表示は父島を中心とし、伊豆諸島と同じ50km目盛になる',()=>{
 const tokyo=pages[12],oga=tokyo.panels.find(p=>p.label==='小笠原諸島')!,izu=tokyo.panels.find(p=>p.label==='伊豆諸島')!;
 expect(mapScale(oga.kilometersPerUnit,oga.initialViewport.zoom).label).toBe('50 km');
 expect(mapScale(izu.kilometersPerUnit,izu.initialViewport.zoom).label).toBe('50 km');
 expect(oga.initialViewport.x+400/oga.initialViewport.zoom).toBeCloseTo(283.603,3);
 expect(oga.initialViewport.y+240/oga.initialViewport.zoom).toBeCloseTo(104.676,3);
});
