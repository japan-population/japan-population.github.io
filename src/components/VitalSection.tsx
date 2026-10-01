import { useState } from 'react';
import { type Migration, type Vital, type DisplayPeriod } from '../types/statistics';
import { monthKey } from '../lib/time';
import { estimatePeriod } from '../lib/estimate';
import { movement } from '../lib/movement';
import { signed } from '../lib/formatting';
import { YearInfo } from './YearInfo';
import { EventCounter } from './EventCounter';
import { SourceInfo } from './SourceInfo';
export function VitalSection({ vital, migration, national = false, now, name }: { vital: Vital; migration?: Migration; national?: boolean; now: number; name: string }) {
  const [period, setPeriod] = useState<DisplayPeriod>('day');
  const month = monthKey(now), models = vital.months[month];
  const birth = models ? estimatePeriod(models.birth, month, now, period, vital.yearToDate?.[month]?.birth) : null;
  const death = models ? estimatePeriod(models.death, month, now, period, vital.yearToDate?.[month]?.death) : null;
  const inflow = movement(migration, month, 'inflow', national), outflow = movement(migration, month, 'outflow', national);
  const incoming = estimatePeriod(inflow.model, month, now, period, inflow.year), outgoing = estimatePeriod(outflow.model, month, now, period, outflow.year);
  return <section id="vital" className="section"><div className="section-heading"><div><span className="eyebrow">VITAL STATISTICS</span><h2>{name}の人口動態</h2></div><div className="segmented" aria-label="集計期間"><button aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>今日</button><button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>今月</button><button aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>今年</button></div></div><p className="section-note">公的統計の最新公表値を基にしたリアルタイム推計</p>
    {period === 'year' && <YearInfo year={vital.yearToDate?.[month]?.birth} month={month} source={vital.source}/>}
    {!models && <p className="warning" role="status">推計モデルの有効期間を過ぎています。データ更新まで、この月の数値を表示できません。</p>}
    <div className={`cards dynamics-cards ${period === 'year' ? 'year-cards' : ''}`}> {(['birth', 'death', 'inflow', 'outflow', 'marriage', 'divorce'] as const).map(kind => {
      const move = kind === 'inflow' ? inflow : kind === 'outflow' ? outflow : undefined;
      const source = move ? migration?.internationalSource : vital.source;
      return <EventCounter key={kind} kind={kind} model={move ? move.model : models?.[kind as keyof typeof models]} month={month} now={now} period={period} year={move ? move.year : vital.yearToDate?.[month]?.[kind as 'birth' | 'death' | 'marriage' | 'divorce']} officialLabel={source?.status === 'provisional' ? '公式概数' : source?.status === 'fixture' ? 'デモ原値' : '公式確定値'}/>;
    })}</div>
    <div className="natural-change"><div><span className="eyebrow">NATURAL CHANGE</span><h3>{period === 'day' ? '今日' : period === 'month' ? '今月' : '今年'}の自然増減 <small>出生 − 死亡</small></h3></div><strong>{birth !== null && death !== null ? signed(birth - death) : '—'} <small>人</small></strong><p>人口動態統計と総人口では集計対象が異なるため、<br/>人口カウンターとは独立した推計です。</p></div>
    <div className="natural-change"><div><span className="eyebrow">MIGRATION CHANGE</span><h3>{period === 'day' ? '今日' : period === 'month' ? '今月' : '今年'}の移動による増減 <small>転入 − 転出</small></h3></div><strong>{incoming !== null && outgoing !== null ? signed(incoming - outgoing) : '—'} <small>人</small></strong></div>
    <p className="small-note">{national ? '全国の転入・転出は国外との移動のみです。' : '転入・転出は他都道府県と国外との移動を合算しています。県内移動は含みません。'}移動は日本人・外国人を含みます。職権消除等を除くため、公式の社会増減数とは異なります。</p>
    {period === 'year' && migration && <div><strong>転入・転出の集計期間</strong><YearInfo year={inflow.year} month={month} source={migration.internationalSource}/></div>}
    {!migration && <p className="warning">転入・転出は人口移動データの更新後に表示します。</p>}
    <SourceInfo source={vital.source}/>
    {migration && <>{!national && <SourceInfo source={migration.domesticSource}/>}<SourceInfo source={migration.internationalSource}/></>}
    <p className="small-note">出生・死亡・婚姻・離婚は、日本において発生した日本人に関する事象が対象です。今日の値は0:00 JSTにリセットします。</p>
  </section>;
}
