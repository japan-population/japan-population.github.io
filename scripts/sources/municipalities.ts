import ExcelJS from 'exceljs';
import {clampMapViewport} from '../../src/lib/map-viewport';
import {parse} from 'csv-parse/sync';
import {PREFECTURES} from '../../src/lib/prefectures';
import {municipalityMapSchema,type MunicipalityMapData} from '../../src/types/municipalities';
export const MUNICIPAL_POPULATION_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040479049&fileKind=0';
export const MUNICIPAL_AREA_URL='https://www.gsi.go.jp/KOKUJYOHO/MENCHO/backnumber/R8_07_mencho.csv';
export const BOUNDARY_REVISION='eccecca8f37d0569e13b56f62d71b137c75ea2f5';
export const MUNICIPAL_BOUNDARY_URL=`https://raw.githubusercontent.com/kyodo-official/japan-choropleth/${BOUNDARY_REVISION}/data/geojson/municipalities.geojson`;
type Point=[number,number];
type Polygon=Point[][];
type Feature={id:string;properties:{municipality:string;ward:string|null;displayName:string};geometry:{type:'Polygon'|'MultiPolygon';coordinates:Polygon|Polygon[]}};
export async function readMunicipalPopulation(bytes:Uint8Array){
 const w=new ExcelJS.Workbook();await w.xlsx.load(bytes as never);const s=w.worksheets[0];
 if(!s.getCell('A1').text.includes('令和8年1月1日')||!s.getCell('A1').text.includes('総計')||s.getCell('F5').text!=='計'||s.getCell('F4').text!=='人口')throw Error('市区町村人口の年・表構造が不一致です');
 const rows=new Map<string,{code:string;name:string;population:number}>();
 s.eachRow(row=>{const code=row.getCell(1).text;if(!/^\d{6}$/.test(code))return;const population=row.getCell(6).value;
  if(typeof population!=='number'||!Number.isSafeInteger(population)||population<0||population<Number(row.getCell(4).value)+Number(row.getCell(5).value))throw Error('市区町村人口の総計が不正です');
  const id=code.slice(0,5);if(rows.has(id))throw Error('市区町村人口が重複しています');rows.set(id,{code:id,name:row.getCell(3).text,population});
 });
 if(rows.size<1700)throw Error('市区町村人口が不足しています');return rows;
}
export function readMunicipalAreas(bytes:Uint8Array){
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('shift-jis').decode(bytes);}
 const rows=parse(text,{relax_column_count:true,bom:true}) as string[][];
 const header=rows.find(r=>r[0]==='標準地域コード');if(header?.[4]!=='令和8年7月1日(k㎡)')throw Error('市区町村面積の年月・表構造が不一致です');
 const result=new Map<string,{areaKm2:number;areaReference:boolean}>();
 for(const r of rows){if(!/^\d{4,5}$/.test(r[0])||!r[3])continue;const code=r[0].padStart(5,'0'),areaKm2=Number(r[4]);if(!(areaKm2>0))throw Error(`面積が不正です: ${code}`);if(result.has(code))throw Error('市区町村面積が重複しています');result.set(code,{areaKm2,areaReference:r[5].includes('参考')});}
 return result;
}
// Island panels use their own scale; never drop a municipality to fit the mainland.
function panelFor(pref:string,code:string,lat:number,lon:number){
 if(pref==='13')return code==='13421'?'小笠原諸島':Number(code)>=13361?'伊豆諸島':'区部・多摩';
 if(pref==='46')return lat<30?'奄美群島':'本土・種子島・屋久島';
 if(pref==='47')return lon<125?'八重山諸島':lon<126?'宮古諸島':lon>130?'大東諸島':'沖縄本島・周辺離島';
 return '';
}
function polygons(f:Feature):Polygon[]{return f.geometry.type==='Polygon'?[f.geometry.coordinates as Polygon]:f.geometry.coordinates as Polygon[];}
function range(points:Point[]){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of points){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('境界座標が不正です');x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return [x0,y0,x1,y1] as const;}
// Cancel shared ward edges, retaining exterior rings and holes when merging a designated city.
function boundaryEdges(polys:Polygon[]):[Point,Point][]{
 const edges=new Map<string,[Point,Point]>();
 for(const polygon of polys)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];const x=a.join(','),y=b.join(',');if(x===y)continue;const key=x<y?`${x}|${y}`:`${y}|${x}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 return [...edges.values()];
}
function mergedRings(polys:Polygon[]):Point[][]{
 const edges=boundaryEdges(polys),next=new Map<string,number[]>();
 edges.forEach(([a,b],i)=>{for(const p of [a,b]){const k=p.join(',');next.set(k,[...(next.get(k)??[]),i]);}});
 const used=new Set<number>(),rings:Point[][]=[];
 edges.forEach(([a,b],start)=>{if(used.has(start))return;used.add(start);const ring=[a,b];let end=b;
  while(end.join(',')!==a.join(',')){const i=(next.get(end.join(','))??[]).find(i=>!used.has(i));if(i===undefined)throw Error('境界リングが閉じていません');used.add(i);const edge=edges[i];end=edge[0].join(',')===end.join(',')?edge[1]:edge[0];ring.push(end);}
  rings.push(ring);
 });return rings;
}
export async function buildMunicipalityMaps(popBytes:Uint8Array,areaBytes:Uint8Array,geo:unknown,now:number):Promise<MunicipalityMapData[]>{
 const population=await readMunicipalPopulation(popBytes),areas=readMunicipalAreas(areaBytes);
 const raw=geo as {features:Feature[]};if(!Array.isArray(raw.features)||raw.features.length<1700)throw Error('市区町村境界が不足しています');
 const municipalities=new Map<string,{name:string;polygons:Polygon[]}>();
 for(const f of raw.features){if(!/^\d{5}$/.test(f.id)||!['Polygon','MultiPolygon'].includes(f.geometry.type))throw Error('境界のコード・形状が不正です');
  if(f.id.endsWith('000')||['01695','01696','01697','01698','01699','01700'].includes(f.id))continue; // Unassigned land uses a prefecture code, not its population.
  const pref=f.id.slice(0,2);
  const row=f.properties.ward&&pref!=='13'?[...population.values()].find(r=>r.code.startsWith(pref)&&r.name===f.properties.municipality):population.get(f.id);
  if(!row||!areas.has(row.code))throw Error(`人口・面積を照合できません: ${f.id}`);
  const current=municipalities.get(row.code)??{name:row.name,polygons:[]};current.polygons.push(...polygons(f));municipalities.set(row.code,current);
 }
 const result=PREFECTURES.map(pref=>{
  const entries=[...municipalities].filter(([code])=>code.startsWith(pref.code));
  const grouped=new Map<string,Map<string,Polygon[]>>();
  for(const [code,m]of entries)for(const polygon of m.polygons){const bounds=range(polygon[0]),lon=(bounds[0]+bounds[2])/2,lat=(bounds[1]+bounds[3])/2;const label=panelFor(pref.code,code,lat,lon);const group=grouped.get(label)??new Map<string,Polygon[]>();group.set(code,[...(group.get(code)??[]),polygon]);grouped.set(label,group);}
  const panels=[...grouped].map(([label,parts],i)=>{
   const points=[...parts.values()].flat(3);const [,minLat,,maxLat]=range(points);const cos=Math.cos((minLat+maxLat)/2*Math.PI/180);
   const project=([lon,lat]:Point):Point=>[lon*cos,-lat];const [minX,minY,maxX,maxY]=range(points.map(project));const scale=Math.min(740/(maxX-minX),420/(maxY-minY));
   const xy=(p:Point):Point=>{const [x,y]=project(p);return [Number(((x-(minX+maxX)/2)*scale+400).toFixed(3)),Number(((y-(minY+maxY)/2)*scale+240).toFixed(3))];};
   const paths=[...parts].map(([code,polys])=>{
    const rings=mergedRings(polys).map(r=>r.map(xy));if(!rings.length)return null;const [x0,y0,x1,y1]=rings.map(r=>range(r)).sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]))[0];
    const d=rings.map(r=>r.map((p,j)=>`${j?'L':'M'}${p.join(',')}`).join('')+'Z').join('');return {code,d,x:(x0+x1)/2,y:(y0+y1)/2};
   }).filter((p):p is NonNullable<typeof p>=>p!==null);// Chichijima lies within the GSI map sheet 27°01′40″–27°07′20″ N, 142°08′15″–142°16′ E.
   const center=xy([142.21,27.075]);
   const initialViewport=label==='小笠原諸島'?clampMapViewport({x:center[0]-400/4,y:center[1]-240/4,zoom:4}):{x:0,y:0,zoom:1};
   return {id:String(i),label,paths,kilometersPerUnit:111.195/scale,initialViewport};
  });
  const retrievedAt=new Date(now).toISOString();return municipalityMapSchema.parse({schemaVersion:1,prefectureCode:pref.code,prefectureName:pref.name,populationDate:'2026-01-01',areaDate:'2026-07-01',
   sources:[{publisher:'総務省',statistics:'住民基本台帳に基づく人口、人口動態及び世帯数調査',table:'26-03【総計】市区町村別人口、人口動態及び世帯数',sourcePeriod:'2026-01',publishedAt:'2026-07-29',retrievedAt,url:MUNICIPAL_POPULATION_URL,status:'final',scope:'2026年1月1日現在。日本人・外国人を含む住民基本台帳人口。政令指定都市は市単位、東京都の特別区は区単位。'},
   {publisher:'国土地理院',statistics:'全国都道府県市区町村別面積調',table:'令和8年7月1日時点 市区町村別面積',sourcePeriod:'2026-07',publishedAt:'2026-09-25',retrievedAt,url:MUNICIPAL_AREA_URL,status:'final',scope:'境界未定部を有する自治体の公表参考面積を含む。人口密度は表示人口÷面積で算出。人口と面積の基準日は異なる。'}],
   boundary:{url:'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html',credit:'国土交通省 国土数値情報「行政区域データ（2025年）」を共同通信社が加工した境界を使用し、本サイトで市単位の統合・投影・座標丸めを実施。所属未定地および北方地域は表示対象外。離島の別枠は縮尺が異なります。',license:'https://creativecommons.org/licenses/by/4.0/',revision:BOUNDARY_REVISION},
   panels,municipalities:entries.map(([code,m])=>({code,name:m.name,population:population.get(code)!.population,...areas.get(code)!})).sort((a,b)=>a.code.localeCompare(b.code))});
 });
 // Reject missing municipalities or accidentally counting ward and city populations twice.
 for(const pref of PREFECTURES){const page=result.find(x=>x.prefectureCode===pref.code)!;if(page.municipalities.reduce((n,m)=>n+m.population,0)!==population.get(pref.code+'000')?.population)throw Error(`市区町村の人口合計が都道府県と一致しません: ${pref.code}`);}
 return result;
}
