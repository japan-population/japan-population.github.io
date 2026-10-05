import {enrichTokyoAverageAges} from './sources/tokyo-average-age';
import {readFile,writeFile} from 'node:fs/promises';
import {readDataset,publishDataset} from './dataset';
import {finalizeDataset} from './scoped-update';
import {enrichTokyoEarlyHistory} from './sources/tokyo-early-history';
import {tokyoAreasSchema,validateTokyoTotals} from '../src/types/tokyo-areas';
import {addTamaFertility,approximateTamaFertility} from './sources/tokyo-fertility';
import {sourceSchema} from '../src/types/statistics';
import fertility from './data/tokyo-tama-fertility.json';
import {enrichTokyoNationalityAllocations} from './sources/tokyo-nationality-allocation';
import {enrichTokyoNationalityHistory} from './sources/tokyo-nationality-history';

// Manual, offline rebuild. Other statistics and projections are not fetched.
const path = new URL('./data/tokyo-history.json',import.meta.url);
const past = enrichTokyoAverageAges(enrichTokyoNationalityAllocations(enrichTokyoNationalityHistory(enrichTokyoEarlyHistory(tokyoAreasSchema.shape.past.parse(JSON.parse(await readFile(path,'utf8')))))));
const data = await readDataset('public/data');
if (!data.tokyoAreas) throw Error('東京都地域データがありません');
for(const observation of fertility){
  const source=sourceSchema.parse(observation.source);
  const reference=observation.reference===true;
  const value=observation.value??approximateTamaFertility(observation.cityRate!,observation.countyRate!,observation.cityWomen!,observation.countyWomen!);
  if(past[observation.year])addTamaFertility(past[observation.year],value,source,reference);
  // Only attach a reviewed value to the matching vital-statistics release.
  const latestYear=data.tokyoAreas.latest.wards.groups.total?.fertilityRate?.source.sourcePeriod.slice(0,4);
  if(latestYear===String(observation.year))addTamaFertility(data.tokyoAreas.latest,value,source,reference);
}
data.tokyoAreas = tokyoAreasSchema.parse({...data.tokyoAreas,past});
validateTokyoTotals(data.tokyoAreas);
await publishDataset(finalizeDataset(data,Date.now()));
await writeFile(path,JSON.stringify(past)+'\n');
console.log('確認済みの東京都過去統計を反映しました（外部取得なし）。');
