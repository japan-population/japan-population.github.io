import {EventBreakdown} from './EventBreakdown';
import type {EventBreakdownData} from '../types/statistics';
import type { EventKind, EventModel, YearTotal, DisplayPeriod } from '../types/statistics';
import type { MovementKind } from '../lib/movement';
import type { DistributionEstimate } from '../lib/distribution/engine';
import { EventIcon } from './EventIcon';
import { intervalLabel, number } from '../lib/formatting';
const LABELS = { birth: ['出生', 'BIRTHS', '人', '↗'], death: ['死亡', 'DEATHS', '人', '↘'], marriage: ['婚姻', 'MARRIAGES', '組', '∞'], divorce: ['離婚', 'DIVORCES', '組', '⇄'], inflow: ['転入', 'INFLOW', '人', '⇥'], outflow: ['転出', 'OUTFLOW', '人', '⇤'] };
export function EventCounter({ kind, model, month, now, period, year, officialLabel, japaneseOnly = false, estimate, breakdowns, breakdownProxy }: { kind: EventKind | MovementKind; model?: EventModel; month: string; now: number; period: DisplayPeriod; year?: YearTotal; officialLabel: string; japaneseOnly?: boolean; estimate?: DistributionEstimate | null; breakdowns?:EventBreakdownData[]; breakdownProxy?:boolean }) {
  const [label, en, unit] = LABELS[kind];
  const rawCount = estimate?.[period];
  const count = rawCount == null ? null : Math.floor(rawCount);
  const forecast = period === 'year' ? year?.estimatedYearCount : model?.estimatedMonthCount;
  const average = period === 'year' ? year?.averagePerDay : model ? model.ratePerSecond * 86400 : undefined;
  return <article className={`stat-card ${kind}`}><div className="card-heading"><EventIcon kind={kind}/><span>{label}<small>{en}</small></span><span className="badge">{!model ? 'データなし' : period === 'year' && year?.officialThrough ? `${officialLabel}＋推計` : '推計'}</span></div>{japaneseOnly && <p className="event-scope">日本人のみ</p>}<p className="stat-period">{period === 'day' ? '今日 現時点まで' : period === 'month' ? '今月 現時点まで' : '今年 現時点まで'}</p><div className="event-value" aria-live="off">{count === null ? '—' : number(count)}<small>{unit}</small></div>{period === 'year' && year && count !== null && <p className="year-parts">{officialLabel} {number(year.officialCount)}{unit}<br/>推計分 {number(count - year.officialCount)}{unit}</p>}<p className="event-interval">{model ? intervalLabel(estimate?.ratePerSecond ?? model.ratePerSecond, unit) : '—'}</p><div className="card-bottom"><div><span>{period === 'year' ? '今年全体の予測' : '今月全体の予測'}</span><strong>{forecast !== undefined ? number(forecast) : '—'} <small>{unit}</small></strong></div><div><span>{period === 'year' ? '今年の1日平均' : '1日平均'}</span><strong>{average !== undefined ? number(average) : '—'} <small>{unit}</small></strong></div></div>{breakdowns&&breakdowns.length>0&&kind!=='inflow'&&kind!=='outflow'&&<EventBreakdown event={kind} sections={breakdowns} total={count} proxy={breakdownProxy} hideHomicide={period==='day'}/>}</article>;
}
