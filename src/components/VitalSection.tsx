import { useState } from 'react';
import { EVENTS, type Vital, type DisplayPeriod } from '../types/statistics';
import { monthKey } from '../lib/time';
import { estimatePeriod } from '../lib/estimate';
import { signed } from '../lib/formatting';
import { YearInfo } from './YearInfo';
import { EventCounter } from './EventCounter';
import { SourceInfo } from './SourceInfo';
export function VitalSection({ vital, now, name }: { vital: Vital; now: number; name: string }) {
  const [period, setPeriod] = useState<DisplayPeriod>('day');
  const month = monthKey(now), models = vital.months[month];
  const birth = models ? estimatePeriod(models.birth, month, now, period, vital.yearToDate?.[month]?.birth) : null;
  const death = models ? estimatePeriod(models.death, month, now, period, vital.yearToDate?.[month]?.death) : null;
  return <section id="vital" className="section"><div className="section-heading"><div><span className="eyebrow">VITAL STATISTICS</span><h2>{name}の人口動態</h2></div><div className="segmented" aria-label="集計期間"><button aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>今日</button><button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>今月</button><button aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>今年</button></div></div><p className="section-note">公的統計の最新公表値を基にしたリアルタイム推計</p>
    {period === 'year' && <YearInfo year={vital.yearToDate?.[month]?.birth} month={month} source={vital.source}/>}
    {!models && <p className="warning" role="status">推計モデルの有効期間を過ぎています。データ更新まで、この月の数値を表示できません。</p>}
    <div className={`cards ${period === 'year' ? 'year-cards' : ''}`}>{EVENTS.map(kind => <EventCounter key={kind} kind={kind} model={models?.[kind]} month={month} now={now} period={period} year={vital.yearToDate?.[month]?.[kind]} officialLabel={vital.source.status === 'provisional' ? '公式概数' : vital.source.status === 'fixture' ? 'デモ原値' : '公式確定値'}/>)}</div>
    <div className="natural-change"><div><span className="eyebrow">NATURAL CHANGE</span><h3>{period === 'day' ? '今日' : period === 'month' ? '今月' : '今年'}の自然増減 <small>出生 − 死亡</small></h3></div><strong>{birth !== null && death !== null ? signed(birth - death) : '—'} <small>人</small></strong><p>人口動態統計と総人口では集計対象が異なるため、<br/>人口カウンターとは独立した推計です。</p></div>
    <SourceInfo source={vital.source}/>
    <p className="small-note">出生・死亡・婚姻・離婚は、日本において発生した日本人に関する事象が対象です。今日の値は0:00 JSTにリセットします。</p>
  </section>;
}
