import {realtimeEventBreakdowns} from '../lib/event-breakdowns';
import { useMemo, useState } from 'react';
import type { National, PopulationGroup, DisplayPeriod } from '../types/statistics';
import { monthKey } from '../lib/time';
import { prepareSeriesPlan, readSeriesPlan } from '../lib/distribution/series';
import { defaultDistribution, eventProfiles } from '../lib/distribution/profiles';
import { signed } from '../lib/formatting';
import { GROUP_LABELS, nationalIndicators } from '../lib/groups';
import { YearInfo } from './YearInfo';
import { EventCounter } from './EventCounter';
import { SourceInfo } from './SourceInfo';
const ORDER = ['birth','death','inflow','outflow','marriage','divorce'] as const;
export function VitalSection({ national, group, now }: { national: National; group: PopulationGroup; now: number }) {
  const compositions=useMemo(()=>Object.fromEntries((['birth','death','marriage','divorce'] as const).map(kind=>[kind,realtimeEventBreakdowns(national.eventBreakdowns,kind,group)])),[national.eventBreakdowns,group]);
  const [period, setPeriod] = useState<DisplayPeriod>('day');
  const month = monthKey(now), year = Number(month.slice(0,4));
  const series = useMemo(()=>nationalIndicators(national,group),[national,group]);
  const distribution=national.distribution??defaultDistribution;
  const profiles=useMemo(()=>eventProfiles(distribution,group),[distribution,group]);
  const plans=useMemo(()=>Object.fromEntries(ORDER.map(k=>[k,prepareSeriesPlan(series[k],year,profiles[k],distribution.calendar)])),[series,year,profiles,distribution]);
  const estimates=Object.fromEntries(ORDER.map(k=>[k,series[k]?.months[month]?readSeriesPlan(plans[k],now):null]));
  const count = (k:typeof ORDER[number]) => {const v=estimates[k]?.[period];return v==null?null:Math.floor(v);};
  const delta = (a:typeof ORDER[number],b:typeof ORDER[number]) => {const x=count(a),y=count(b);return x===null||y===null?'—':signed(x-y);};
  const sources = Object.values(series).filter((s,i,all)=>all.findIndex(v=>v.source.url===s.source.url&&v.source.sourcePeriod===s.source.sourcePeriod&&v.source.table===s.source.table&&v.source.scope===s.source.scope)===i);
  return <section id="vital" className="section"><div className="section-heading section-controls section-switch-heading"><div><span className="eyebrow">VITAL STATISTICS</span><h2>人口動態推計 <small>{GROUP_LABELS[group]}</small></h2></div><div className="segmented" role="group" aria-label="集計期間">{(['day','month','year'] as const).map((p,i)=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{['今日','今月','今年'][i]}</button>)}</div></div>
    <div className={`cards dynamics-cards ${period==='year'?'year-cards':''}`}>{ORDER.map(kind=><EventCounter key={kind} kind={kind} breakdowns={kind==='inflow'||kind==='outflow'?undefined:compositions[kind].sections} breakdownProxy={compositions[kind]?.proxy} estimate={estimates[kind]} japaneseOnly={group==='total'&&(kind==='marriage'||kind==='divorce')} model={series[kind]?.months[month]} month={month} now={now} period={period} year={series[kind]?.yearToDate[month]} officialLabel={series[kind]?.source.status==='provisional'?'公式概数':series[kind]?.source.status==='fixture'?'デモ原値':'公式確定値'}/>)}</div>
    <div className="change-grid"><div><span>自然増減 <small>出生 − 死亡</small></span><strong>{delta('birth','death')} <small>人</small></strong></div><div><span>移動による増減 <small>転入 − 転出</small></span><strong>{delta('inflow','outflow')} <small>人</small></strong></div></div>
    <details className="method-details"><summary>集計方法・出典</summary><p>表示は公的統計に基づく推計です。各指標は出典・公表時期が異なり、人口カウンターとは独立しています。総人口表示の婚姻・離婚には日本人の値を掲載しています。外国人の婚姻・離婚は未収録です。</p><p>月総数を固定し、曜日・祝日・時間帯の重みで日内の期待累積値を計算します。出生の分布は{distribution.birthProfile.daily.sourceYear}年の公的な日本人の統計から算出（総数・外国人へは代用）。他の5項目と婚姻の記念日補正は独自仮定です。実際の発生時刻や精度向上を保証するものではありません。</p><p><a href={distribution.birthProfile.hourlyProfiles.weekday.url} target="_blank" rel="noreferrer">出生の日別・時刻別統計</a> ／ <a href={distribution.calendar.url} target="_blank" rel="noreferrer">内閣府の祝日表</a></p>{year>distribution.calendar.throughYear&&<p>この年の公式祝日表は未収録のため、曜日のみで配分しています。</p>}{sources.map(s=><div key={s.source.url+s.source.sourcePeriod+s.source.table+s.source.scope}>{period==='year'&&<YearInfo year={s.yearToDate[month]} month={month} source={s.source}/>}<SourceInfo source={s.source}/></div>)}</details>
  </section>;
}
