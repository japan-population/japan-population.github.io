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
    {breakdown && <details className="official-details"><summary>公式人口の男女別内訳・年齢構成を見る</summary><section className="population-breakdown">
      <h2>{labels[group]}の公式内訳</h2><p className="small-note">最新の月次公式人口は上の「最新公式確定値」に表示しています。以下の内訳は、それぞれに記載した基準日の値です。</p>
      {breakdown.exactSex ? <><h3>男女別人口（1人単位の公表原値）</h3><p>{monthLabel(breakdown.exactSex.source.sourcePeriod)}1日現在 <span className="badge">{demo ? 'デモ値' : '公式確定値'}</span></p><div className="sex-summary">{(['male', 'female'] as const).map(s => <div key={s}><span>{s === 'male' ? '男性' : '女性'}</span><strong>{number(breakdown.exactSex!.groups[group][s])} <small>人</small></strong></div>)}</div><SourceInfo source={breakdown.exactSex.source}/></> : <p className="small-note">男女別の1人単位の原値は、データ更新後に表示します。</p>}
      <p>{monthLabel(breakdown.source.sourcePeriod)}1日現在の年齢構成。年齢階級別の公表単位は千人です。</p><PopulationPyramid key={group} rows={breakdown.rows.filter(r => r.group === group)} label={labels[group]}/><SourceInfo source={breakdown.source}/>
    </section></details>}
  </>;
}
