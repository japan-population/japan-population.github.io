import { useState } from 'react';
import type { National, PopulationGroup, DisplayPeriod } from '../types/statistics';
import { monthKey } from '../lib/time';
import { estimatePeriod } from '../lib/estimate';
import { signed } from '../lib/formatting';
import { GROUP_LABELS, nationalIndicators } from '../lib/groups';
import { YearInfo } from './YearInfo';
import { EventCounter } from './EventCounter';
import { SourceInfo } from './SourceInfo';
const ORDER = ['birth','death','inflow','outflow','marriage','divorce'] as const;
export function VitalSection({ national, group, now }: { national: National; group: PopulationGroup; now: number }) {
  const [period, setPeriod] = useState<DisplayPeriod>('day');
  const month = monthKey(now), series = nationalIndicators(national,group);
  const count = (k:typeof ORDER[number]) => estimatePeriod(series[k]?.months[month],month,now,period,series[k]?.yearToDate[month]);
  const delta = (a:typeof ORDER[number],b:typeof ORDER[number]) => {const x=count(a),y=count(b);return x===null||y===null?'—':signed(x-y);};
  const sources = Object.values(series).filter((s,i,all)=>all.findIndex(v=>v.source.url===s.source.url&&v.source.sourcePeriod===s.source.sourcePeriod)===i);
  return <section id="vital" className="section"><div className="section-heading"><div><span className="eyebrow">VITAL STATISTICS</span><h2>全国の人口動態 <small>{GROUP_LABELS[group]}</small></h2></div><div className="segmented" role="group" aria-label="集計期間">{(['day','month','year'] as const).map((p,i)=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{['今日','今月','今年'][i]}</button>)}</div></div>
    <div className={`cards dynamics-cards ${period==='year'?'year-cards':''}`}>{ORDER.map(kind=><EventCounter key={kind} kind={kind} model={series[kind]?.months[month]} month={month} now={now} period={period} year={series[kind]?.yearToDate[month]} officialLabel={series[kind]?.source.status==='provisional'?'公式概数':series[kind]?.source.status==='fixture'?'デモ原値':'公式確定値'}/>)}</div>
    <div className="change-grid"><div><span>自然増減 <small>出生 − 死亡</small></span><strong>{delta('birth','death')} <small>人</small></strong></div><div><span>移動による増減 <small>転入 − 転出</small></span><strong>{delta('inflow','outflow')} <small>人</small></strong></div></div>
    <p className="small-note">転入・転出は国外との移動。— はこの区分のデータなし。</p>
    <details className="method-details"><summary>集計方法・出典</summary><p>表示は公的統計に基づく推計です。各指標は出典・公表時期が異なり、人口カウンターとは独立しています。総数・外国人の婚姻と離婚は、対応する月次系列を未収録です。</p>{sources.map(s=><div key={s.source.url+s.source.sourcePeriod}>{period==='year'&&<YearInfo year={s.yearToDate[month]} month={month} source={s.source}/>}<SourceInfo source={s.source}/></div>)}</details>
  </section>;
}
