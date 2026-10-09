// Manual refresh only. Boundary revision and source dates are pinned and reviewed together.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildMunicipalityMaps,MUNICIPAL_POPULATION_URL,MUNICIPAL_AREA_URL,MUNICIPAL_BOUNDARY_URL} from './sources/municipalities';
const cache=resolve('.cache/municipalities');
const local=process.argv.includes('--cached');
async function input(name:string,url:string){
 if(local)return readFile(resolve(cache,name));
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`取得失敗: ${name}`);
 const b=Buffer.from(await r.arrayBuffer());await mkdir(cache,{recursive:true});await writeFile(resolve(cache,name),b);return b;
}
const stage=resolve(`.data-stage-municipalities-${process.pid}`),backup=resolve(`.data-backup-municipalities-${process.pid}`),destination=resolve('public/maps/municipalities');
let moved=false;
try{
 const [population,area,geo]=await Promise.all([input('population.xlsx',MUNICIPAL_POPULATION_URL),input('area.csv',MUNICIPAL_AREA_URL),input('boundaries.geojson',MUNICIPAL_BOUNDARY_URL)]);
 const pages=await buildMunicipalityMaps(population,area,JSON.parse(geo.toString('utf8')),Date.now());
 await mkdir(stage,{recursive:true});for(const page of pages)await writeFile(resolve(stage,`${page.prefectureCode}.json`),JSON.stringify(page)+'\n');
 await mkdir(resolve('public/maps'),{recursive:true});
 try{await rename(destination,backup);moved=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 try{await rename(stage,destination);}catch(e){if(moved)await rename(backup,destination);throw e;}
 await rm(backup,{recursive:true,force:true});console.log(`${pages.length}都道府県・${pages.reduce((n,p)=>n+p.municipalities.length,0)}市区町村を更新しました`);
}catch(e){console.error(e instanceof Error?e.message:'市区町村地図の生成に失敗しました');process.exitCode=1;}finally{await rm(stage,{recursive:true,force:true});}
