// Manual only: pass the downloaded World Bank latest-country and world-history GDP JSON files.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {worldGdpData} from './sources/world-gdp';
import {worldMapSchema} from '../src/types/world-map';
const [countryFile,worldFile]=process.argv.slice(2);
if(!countryFile||!worldFile)throw new Error('Specify latest GDP and world GDP JSON paths');
const gdp=worldGdpData(JSON.parse(await readFile(countryFile,'utf8')),JSON.parse(await readFile(worldFile,'utf8')));
const path='public/maps/world.json';
const data=JSON.parse(await readFile(path,'utf8'));
const result=worldMapSchema.parse({...data,countries:data.countries.map((c:{code:string})=>({...c,gdp:gdp.get(c.code)})),sources:[...data.sources.filter((s:{url:string})=>s.url!==gdp.source.url),gdp.source]});
await writeFile(path+'.tmp',JSON.stringify(result)+'\n');
await rename(path+'.tmp',path);
console.log(`GDP: ${result.countries.filter(c=>c.gdp!==null).length}/${result.countries.length} countries and areas`);
