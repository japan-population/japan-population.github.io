import {FutureExplorer} from '../components/FutureExplorer';
import type { SiteData, PopulationGroup } from '../types/statistics';
import { PopulationExplorer } from '../components/PopulationExplorer';
import { PopulationCounter } from '../components/PopulationCounter';
import { VitalSection } from '../components/VitalSection';
import { JapanMap } from '../components/JapanMap';
import { GROUP_LABELS } from '../lib/groups';
export function Home({data,now,group}:{data:SiteData;now:number;group:PopulationGroup}) {
  const p=data.national.breakdown?.groups[group]??(group==='total'?data.national.population:undefined);
  return <>{p?<PopulationCounter population={p} now={now} demo={data.manifest.mode==='fixture'} label={GROUP_LABELS[group]}/>:<section className="population-hero"><h1>{GROUP_LABELS[group]}の推計人口</h1><div className="population-number">—</div><p>データ更新後に表示します。</p></section>}<VitalSection national={data.national} group={group} now={now}/><PopulationExplorer national={data.national} group={group} demo={data.manifest.mode==='fixture'}/>{data.national.projections&&<FutureExplorer data={data.national.projections} group={group} now={now}/>}<JapanMap data={data} group={group}/></>;
}
