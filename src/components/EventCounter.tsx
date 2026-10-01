import type { EventKind, EventModel, YearTotal, DisplayPeriod } from '../types/statistics';
import type { MovementKind } from '../lib/movement';
import { estimatePeriod } from '../lib/estimate';
import { intervalLabel, number } from '../lib/formatting';
const LABELS = { birth: ['出生', 'BIRTHS', '人', '↗'], death: ['死亡', 'DEATHS', '人', '↘'], marriage: ['婚姻', 'MARRIAGES', '組', '∞'], divorce: ['離婚', 'DIVORCES', '組', '⇄'], inflow: ['転入', 'INFLOW', '人', '⇥'], outflow: ['転出', 'OUTFLOW', '人', '⇤'] };
export function EventCounter({ kind, model, month, now, period, year, officialLabel }: { kind: EventKind | MovementKind; model?: EventModel; month: string; now: number; period: DisplayPeriod; year?: YearTotal; officialLabel: string }) {
  const [label, en, unit, icon] = LABELS[kind];
  const count = estimatePeriod(model, month, now, period, year);
  const forecast = period === 'year' ? year?.estimatedYearCount : model?.estimatedMonthCount;
  const average = period === 'year' ? year?.averagePerDay : model ? model.ratePerSecond * 86400 : undefined;
  return <article className={`stat-card ${kind}`}><div className="card-heading"><span className="event-icon" aria-hidden="true">{icon}</span><span>{label}<small>{en}</small></span><span className="badge">{!model ? 'データなし' : period === 'year' && year?.officialThrough ? `${officialLabel}＋推計` : '推計'}</span></div><p className="stat-period">{period === 'day' ? '今日ここまで' : period === 'month' ? '今月ここまで' : '今年ここまで'}</p><div className="event-value" aria-live="off">{count === null ? '—' : number(count)}<small>{unit}</small></div>{period === 'year' && year && count !== null && <p className="year-parts">{officialLabel} {number(year.officialCount)}{unit}<br/>推計分 {number(count - year.officialCount)}{unit}</p>}<p className="event-interval">{period === 'year' && '今月のペース：'}{model ? intervalLabel(model.ratePerSecond, unit) : '—'}</p><div className="card-bottom"><div><span>{period === 'year' ? '今年全体の予測' : '今月全体の予測'}</span><strong>{forecast !== undefined ? number(forecast) : '—'} <small>{unit}</small></strong></div><div><span>{period === 'year' ? '今年の1日平均' : '1日平均'}</span><strong>{average !== undefined ? number(average) : '—'} <small>{unit}</small></strong></div></div></article>;
}
