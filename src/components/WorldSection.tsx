import WorldMap from './WorldMap';
import { WorldEventBreakdown } from './WorldEventBreakdown';
import { memo, useState } from 'react';
import { useClock } from '../hooks/useClock';
import rawPopulation from '../data/world-population.json';
import { estimateWorldPopulation, estimateWorldEvents, worldPopulationSchema } from '../lib/world-population';
import { number, signed } from '../lib/formatting';
import { EventCounter } from './EventCounter';
import type { DisplayPeriod } from '../types/statistics';
import { monthKey } from '../lib/time';
import { SourceInfo } from './SourceInfo';
const population = worldPopulationSchema.parse(rawPopulation);
const worldDateTime = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
// Keep the twice-per-second state updates inside the counter, away from the
// map, source disclosure and the rest of the dashboard.
const WorldCounter = memo(function WorldCounter({now: suppliedNow}:{now?:number}) {
  const clock = useClock(500);
  const now = suppliedNow ?? clock;
  const estimate = estimateWorldPopulation(population, now);
  return <>
      <div className="world-counter-heading"><h3>世界の推計人口</h3>{estimate && <span className="live-label"><i aria-hidden="true"/><span>JST · 0.5秒ごとに更新</span></span>}</div>
      {estimate ? <>
        <div className="population-number world-population-number" aria-live="off">{number(estimate.population)}<span>人</span></div>
        <p className="clock">{worldDateTime.format(now)} 現在</p>
        <p className="world-change">1日あたり <strong>{signed(estimate.ratePerSecond*86400)}</strong> 人</p>
      </> : <p className="small-note">この日時の推計データはありません。</p>}
  </>;
});
const WorldVitalCards = memo(function WorldVitalCards({now: suppliedNow}:{now?:number}) {
  const clock = useClock(500);
  const now = suppliedNow ?? clock;
  const [period,setPeriod] = useState<DisplayPeriod>('day');
  return <div className="world-vital">
    <div className="section-heading section-switch-heading"><h3>世界の人口動態推計</h3><div className="segmented" role="group" aria-label="世界の人口動態の集計期間">{(['day','month','year'] as const).map((p,i)=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{['今日','今月','今年'][i]}</button>)}</div></div>
    <div className="cards dynamics-cards">{(['birth','death'] as const).map(kind=>{
      const value = estimateWorldEvents(population,now,kind);
      return <EventCounter key={kind} kind={kind} model={value?.model} estimate={value?.estimate} year={value?.year} month={monthKey(now)} now={now} period={period} officialLabel="公的推計" showYearParts={false}><WorldEventBreakdown event={kind} year={Number(monthKey(now).slice(0,4))} total={value?.estimate[period]??null}/></EventCounter>;
    })}</div>
  </div>;
});
export function WorldSection({now}:{now?:number}) {
  return <section className="section world-section" aria-labelledby="world-heading">
    <div className="section-controls section-heading"><div><span className="eyebrow">WORLD</span><h2 id="world-heading">世界を見る</h2></div></div>
    <div className="world-card">
      <WorldCounter now={now}/>
      <p className="small-note world-description">国連の年次中位推計を基にしたリアルタイム推計</p>
      <WorldMap/>
    </div>
    <WorldVitalCards now={now}/>
    <SourceInfo source={population.source} showPeriod={false}/>
  </section>;
}
