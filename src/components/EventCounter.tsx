import type { EventKind, EventModel } from '../types/statistics';
import { estimateEvent } from '../lib/estimate';
import { intervalLabel, number } from '../lib/formatting';
const LABELS = { birth: ['出生', 'BIRTHS', '人', '↗'], death: ['死亡', 'DEATHS', '人', '↘'], marriage: ['婚姻', 'MARRIAGES', '組', '∞'], divorce: ['離婚', 'DIVORCES', '組', '⇄'] };
export function EventCounter({ kind, model, month, now, period }: { kind: EventKind; model?: EventModel; month: string; now: number; period: 'day' | 'month' }) {
  const [label, en, unit, icon] = LABELS[kind];
  const count = model ? estimateEvent(model, month, now, period) : null;
  return <article className={`stat-card ${kind}`}><div className="card-heading"><span className="event-icon" aria-hidden="true">{icon}</span><span>{label}<small>{en}</small></span><span className="badge">推計</span></div><p className="stat-period">{period === 'day' ? '今日ここまで' : '今月ここまで'}</p><div className="event-value" aria-live="off">{count === null ? '—' : number(count)}<small>{unit}</small></div><p className="event-interval">{model ? intervalLabel(model.ratePerSecond, unit) : 'この月の推計モデルがありません'}</p><div className="card-bottom"><div><span>今月全体の予測</span><strong>{model ? number(model.estimatedMonthCount) : '—'} <small>{unit}</small></strong></div><div><span>1日平均</span><strong>{model ? number(model.ratePerSecond * 86400) : '—'} <small>{unit}</small></strong></div></div></article>;
}
