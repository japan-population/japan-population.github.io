import {readFile} from 'node:fs/promises';
import {readDataset,publishDataset} from './dataset';
import {finalizeDataset} from './scoped-update';
import {fetchTokyoLatest} from './sources/tokyo-areas';
import {projectTokyoTimeline} from './models/tokyo-projections';
import {tokyoAreasSchema} from '../src/types/tokyo-areas';
// Explicit manual entry point. Historical snapshots are reviewed, checked-in observations.
const now=Date.now(),data=await readDataset('public/data');
const latest=await fetchTokyoLatest(now),past=JSON.parse(await readFile(new URL('./data/tokyo-history.json',import.meta.url),'utf8'));
if(!data.regionalTimeline)throw Error('地域の将来推計がありません');
const future=projectTokyoTimeline(data.regionalTimeline.future,past['2020'],latest);
data.tokyoAreas=tokyoAreasSchema.parse({latest,past,future});data.manifest.tokyoAreas=true;
await publishDataset(finalizeDataset(data,now));console.log('東京都の地域データを更新しました。');
