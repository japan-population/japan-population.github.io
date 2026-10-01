import { useState } from 'react';
import { populationGroups, type National } from '../types/statistics';
import { SourceInfo } from './SourceInfo';
import { PopulationPyramid } from './PopulationPyramid';
import { PopulationCounter } from './PopulationCounter';
import { monthLabel, number } from '../lib/formatting';
const labels = { total: '総人口', japanese: '日本人人口', foreign: '外国人人口' };
export function PopulationExplorer({ national, now, demo }: { national: National; now: number; demo: boolean }) {
  const [group, setGroup] = useState<typeof populationGroups[number]>('total');
  const breakdown = national.breakdown;
  const population = breakdown?.groups[group] ?? national.population;
  return <>
    {breakdown && <div className="population-switch" role="group" aria-label="人口区分">{populationGroups.map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{labels[g]}</button>)}</div>}
    <PopulationCounter population={population} now={now} demo={demo} label={labels[group]}/>
    {breakdown ? <section className="section population-breakdown"><div className="section-heading"><div><span className="eyebrow">POPULATION BREAKDOWN</span><h2>{labels[group]}の内訳</h2></div><span className="badge">{demo ? 'デモ値' : '公式確定値'}</span></div><p>{monthLabel(breakdown.source.sourcePeriod)}1日現在。公表単位は千人です。現在時刻の推計値とは基準が異なります。</p><div className="sex-summary">{(['男女計', '男', '女'] as const).map(s => <div key={s}><span>{s}</span><strong>{number(breakdown.rows.find(r => r.group === group && r.sex === s && r.age === '総数')!.value)} <small>人</small></strong></div>)}</div><PopulationPyramid key={group} rows={breakdown.rows.filter(r => r.group === group)} label={labels[group]}/><SourceInfo source={breakdown.source}/></section> : <p className="small-note">人口区分・男女別・年齢階級別は、拡張データの初回更新後に表示します。</p>}
  </>;
}
