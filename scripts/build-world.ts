import {worldGdpData} from './sources/world-gdp';
/** Manual only. Inputs: official WPP2024 medium CSV.gz and Natural Earth 5.1.2 GeoJSON.
 * node --import tsx scripts/build-world.ts /path/to/wpp.csv.gz /path/to/countries.geojson [mapYear] /path/to/worldbank-areas.json
 * No network requests; deliberately excluded from scheduled data updates.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { worldMapSchema } from '../src/types/world-map';
import { worldPopulationSchema } from '../src/lib/world-population';
const [populationFile, mapFile, yearArgument, areaFile, gdpFile, worldGdpFile] = process.argv.slice(2);
const mapYear = Number(yearArgument ?? new Intl.DateTimeFormat('en', {year: 'numeric', timeZone: 'Asia/Tokyo'}).format(new Date()));
if (!Number.isInteger(mapYear) || mapYear < 2024 || mapYear > 2100) throw new Error('Map year must be within 2024–2100');
if (!populationFile || !mapFile || !areaFile || !gdpFile || !worldGdpFile) throw new Error('Specify WPP CSV.gz, Natural Earth GeoJSON, map year and World Bank area, latest GDP and world GDP JSON paths');
const rows = parse(gunzipSync(await readFile(populationFile)), { columns: true, bom: true }) as Record<string,string>[];
const data = worldPopulationSchema.parse({
  source: {
    publisher: '国際連合（UN DESA）', statistics: 'World Population Prospects 2024',
    table: 'World / Countries and areas・Medium・Population, Births, Deaths', sourcePeriod: '2024-07',
    publishedAt: '2024-07-11', retrievedAt: new Date().toISOString(),
    url: 'https://population.un.org/wpp/', status: 'projection',
    scope: `地図は${mapYear}年7月1日の国・地域別中位推計人口で色分け（多いほど明るい緑、対数尺度）。統計と地図の地域範囲を対応できない領域は灰色。世界人口カウンターは世界・男女計。2024～2100年の各年7月1日の中位推計（原表は千人）を人数へ換算。年次値の間を線形補間し、基準時刻は7月1日0時JSTとしています。実測値ではありません。出生・死亡は世界の年次中位推計総数を、その年の日数・経過秒数に比例して均等配分します。日本の曜日・祝日・時間帯補正は適用しません。`,
  },
  downloadUrl: 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz',
  annualEvents: rows.filter(r => r.LocID === '900' && r.Variant === 'Medium' && Number(r.Time) >= 2024 && Number(r.Time) <= 2100)
    .map(r => ({ year: Number(r.Time), birth: Math.round(Number(r.Births)*1000), death: Math.round(Number(r.Deaths)*1000) })),
  points: rows.filter(r => r.LocID === '900' && r.Variant === 'Medium' && Number(r.Time) >= 2024 && Number(r.Time) <= 2100)
    .map(r => ({ date: `${r.Time}-07-01T00:00:00+09:00`, population: Math.round(Number(r.TPopulation1July) * 1000) })),
});
if (data.points.length !== 77) throw new Error('Expected all 77 medium projection years, 2024–2100');
type Point = [number, number];
type Feature = { properties: { ADM0_A3: string; ISO_A3_EH: string; NAME_JA: string }; geometry: { type: string; coordinates: Point[][] | Point[][][] } };
const geo = JSON.parse(await readFile(mapFile, 'utf8')) as {features: Feature[]};
if (geo.features.length !== 177) throw new Error('Unexpected Natural Earth 110m country count');
// Natural Earth groups French Guiana with France.
// Separate them to match the UN population statistical areas.
const features:Feature[]=geo.features.flatMap(feature=>{
  const code=feature.properties.ADM0_A3;
  if(code!=='FRA')return [feature];
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates as Point[][]]:feature.geometry.coordinates as Point[][][];
  const mainland:Point[][][]=[],territory:Point[][][]=[];
  for(const polygon of polygons){
    const ring=polygon[0],lon=ring.reduce((n,p)=>n+p[0],0)/ring.length,lat=ring.reduce((n,p)=>n+p[1],0)/ring.length;
    (lon < -30?territory:mainland).push(polygon);
  }
  const parts:Feature[]=[{...feature,geometry:{type:'MultiPolygon',coordinates:mainland}}];
  if(territory.length)parts.push({properties:{ADM0_A3:'GUF',ISO_A3_EH:'GUF',NAME_JA:'フランス領ギアナ'},geometry:{type:'MultiPolygon',coordinates:territory}});
  return parts;
});
const areaResponse=JSON.parse(await readFile(areaFile,'utf8')) as [{pages:number;lastupdated:string},Array<{countryiso3code:string;value:number|null;date:string}>];
if(areaResponse[0].pages!==1)throw new Error('World Bank area response must include all pages');
const areas=new Map(areaResponse[1].filter(r=>r.value!==null&&r.value>0).map(r=>[r.countryiso3code,r]));
const populationRows=new Map(rows.filter(r=>r.Time===String(mapYear)&&r.Variant==='Medium'&&r.ISO3_code).map(r=>[r.ISO3_code,r]));
// Pacific centred, central meridian 150°E. Cut rings at the Atlantic seam,
// rather than drawing long lines between opposite edges of the world.
function clip(points: Point[], boundary: number, keepGreater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = keepGreater ? a[0] >= boundary : a[0] <= boundary;
    const insideB = keepGreater ? b[0] >= boundary : b[0] <= boundary;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push([boundary, a[1] + (b[1] - a[1]) * (boundary - a[0]) / (b[0] - a[0])]);
  }
  return result;
}
function ringPath(ring: Point[]): string {
  const points: Point[] = [];
  for (const [raw, lat] of ring) {
    let lon = raw;
    if (points.length) {
      const previous = points[points.length - 1][0];
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
    }
    points.push([lon, lat]);
  }
  // A polar ring makes a complete turn around the globe; close it at the pole.
  if (Math.abs(points[points.length - 1][0] - points[0][0]) > 180) {
    const pole = points[0][1] < 0 ? -90 : 90;
    points.push([points[points.length - 1][0], pole], [points[0][0], pole]);
  }
  return [-720, -360, 0, 360, 720].map(offset => {
    const cut = clip(clip(points.map(([x,y]) => [x + offset,y]), -30,true),330,false);
    if (cut.length < 3) return '';
    return cut.map(([x,y],i) => `${i ? 'L' : 'M'}${((x+30)*1200/360).toFixed(2)},${((90-y)*600/180).toFixed(2)}`).join('') + 'Z';
  }).join('');
}
// Join the UN country/area series by ISO3, never use the map's older POP_EST.
const byCountry = new Map(rows.filter(r => r.Time === String(mapYear) && r.Variant === 'Medium' && r.ISO3_code)
  .map(r => [r.ISO3_code, Math.round(Number(r.TPopulation1July) * 1000)]));
function countryPopulation(feature: Feature) {
  // Natural Earth's Kosovo code differs from the UN series. Other unmatched
  // territories remain unknown; do not reuse the whole country's population.
  const code = feature.properties.ADM0_A3 === 'KOS' ? 'XKX' : feature.properties.ISO_A3_EH;
  return byCountry.get(code);
}
const known = features.map(countryPopulation).filter((n): n is number => n !== undefined);
if (known.length < 170 || known.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Incomplete country population series');
const minimum = Math.min(...known), maximum = Math.max(...known);
const gdp=worldGdpData(JSON.parse(await readFile(gdpFile,'utf8')),JSON.parse(await readFile(worldGdpFile,'utf8')));
const countries = features.map(f => {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Point[][]] : f.geometry.coordinates as Point[][][];
  const population = countryPopulation(f);
  const lightness = population === undefined ? 0 : 25 + 55 * (Math.log1p(population)-Math.log1p(minimum)) / (Math.log1p(maximum)-Math.log1p(minimum));
  const fill = population === undefined ? '#d4d8d5' : `hsl(151,24%,${lightness.toFixed(2)}%)`;
  const code=f.properties.ADM0_A3==='KOS'?'XKX':f.properties.ISO_A3_EH;
  const row=populationRows.get(code),area=areas.get(code);
  // Keep a matching statistical territory when WB includes overseas areas.
  const reference=!!row&&(!area||code==='FRA');
  const density=Number(row?.PopDensity);
  const areaKm2=reference&&population&&density>0?Math.round(population/density):area?.value??null;
  return {gdp:gdp.get(f.properties.ADM0_A3),code:f.properties.ADM0_A3,name:f.properties.NAME_JA,d:polygons.flatMap(p=>p.map(ringPath)).join(''),fill,population:population??null,areaKm2,areaYear:areaKm2===null?null:reference?mapYear:Number(area!.date),areaReference:reference};
});
const mapData=worldMapSchema.parse({populationDate:`${mapYear}-07-01`,countries,sources:[gdp.source,
  {...data.source,table:'国・地域別人口・人口密度',scope:'人口は国連の中位推計。世界銀行の面積がない地域、および統計上の地域範囲を揃える必要があるフランスでは、同じ国連統計の人口÷人口密度から面積の参考値を求めます。参考面積は丸められた公表人口密度からの逆算です。人口密度の表示は人口÷表示面積。フランス領ギアナは本国と分離。ノルウェー人口は国連の定義によりスヴァールバル諸島・ヤンマイエン島を含みます。地図境界と各統計の領域定義は完全には一致しません。'},
  {publisher:'世界銀行・FAO',statistics:'World Development Indicators',table:'Surface area (AG.SRF.TOTL.K2)',sourcePeriod:areaResponse[0].lastupdated.slice(0,7),publishedAt:areaResponse[0].lastupdated,retrievedAt:new Date().toISOString(),url:'https://data.worldbank.org/indicator/AG.SRF.TOTL.K2',status:'final',scope:'各国・地域の最新公表面積（km²）。基準年は各ツールチップに表示。人口と面積は別の統計であり、公表時期・範囲の差があります。CC BY 4.0。'},
]});
const paths = countries.map(f=>`<path data-country="${f.code}"${f.population===null?'':` data-population="${f.population}"`} fill="${f.fill}" d="${f.d}"/>`).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600"><title>国・地域別人口地図（${mapYear}年・太平洋中心）</title><desc>人口が多いほど明るい緑。対応する人口データがない領域は灰色。</desc><rect width="1200" height="600" fill="#f5f6f2"/><g fill="#86a993" stroke="#f5f6f2" stroke-width=".8" stroke-linejoin="round" fill-rule="evenodd">${paths}</g></svg>\n`;
await mkdir('src/data', {recursive:true});
await mkdir('public/maps', {recursive:true});
await writeFile('src/data/world-population.json', JSON.stringify(data,null,2)+'\n');
await writeFile('public/maps/world.svg', svg);
await writeFile('public/maps/world.json',JSON.stringify(mapData)+'\n');
console.log(`World: ${data.points.length} population anchors, ${geo.features.length} map features`);
