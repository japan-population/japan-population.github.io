import type { National, PopulationGroup } from '../types/statistics';
import { SourceInfo } from './SourceInfo';
import { PopulationPyramid } from './PopulationPyramid';
import { monthLabel, number } from '../lib/formatting';
import { GROUP_LABELS } from '../lib/groups';
export function PopulationExplorer({ national, group, demo }: { national: National; group: PopulationGroup; demo: boolean }) {
  const b = national.breakdown, p = b?.groups[group] ?? (group==='total'?national.population:undefined);
  const sameDate = b && p && b.source.sourcePeriod===p.source.sourcePeriod;
  const exact = b?.exactSex?.source.sourcePeriod===p?.source.sourcePeriod ? b?.exactSex : undefined;
  return <section id="official" className="section official-section"><div className="section-heading"><div><span className="eyebrow">OFFICIAL STATISTICS</span><h2>公式確定値 <small>{GROUP_LABELS[group]}</small></h2></div>{p&&<span>{monthLabel(p.source.sourcePeriod)}1日現在</span>}</div>
    <div className="official-summary"><div><span>{demo?'デモの基準人口':'最新公式確定値'}</span><strong>{p?number(p.base):'—'} <small>人</small></strong></div>{(['male','female'] as const).map((sex,i)=>{const raw=exact?.groups[group][sex];const rounded=sameDate?b.rows.find(r=>r.group===group&&r.age==='総数'&&r.sex===(i===0?'男':'女'))?.value:undefined;return <div key={sex}><span>{i===0?'男性':'女性'}</span><strong>{(raw??rounded)!==undefined?((raw??rounded)!/10000).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'} <small>万人</small></strong>{raw===undefined&&rounded!==undefined&&<small>公表単位：千人</small>}</div>;})}</div>
    {p&&<SourceInfo source={p.source}/>}
    {sameDate&&<div className="official-pyramid"><PopulationPyramid key={group} rows={b.rows.filter(r=>r.group===group)} label={GROUP_LABELS[group]}/><SourceInfo source={b.source}/></div>}
  </section>;
}
