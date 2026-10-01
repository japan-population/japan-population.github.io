import { useState } from 'react';
import { MIGRATIONS, type Migration } from '../types/statistics';
import { monthKey } from '../lib/time';
import { estimateEvent } from '../lib/estimate';
import { number, signed, intervalLabel } from '../lib/formatting';
import { SourceInfo } from './SourceInfo';
const labels = { domesticIn: '国内転入', domesticOut: '国内転出', internationalIn: '国外転入', internationalOut: '国外転出' };
export function MigrationSection({ migration, now, name }: { migration?: Migration; now: number; name: string }) {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const month = monthKey(now); const models = migration?.months[month];
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">MIGRATION</span><h2>{name}の転入・転出</h2></div><div className="population-switch" role="group" aria-label="移動の表示期間"><button aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>今日</button><button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>今月</button></div></div>{!migration ? <p>人口移動の初回データ更新待ちです。</p> : !models ? <p className="warning">今月の推計モデルがありません。データの更新が必要です。</p> : <><div className="cards">{MIGRATIONS.map(k => <article className="stat-card" key={k}><div className="card-heading"><h3>{labels[k]}</h3><span className="badge">推計</span></div><p>{period === 'day' ? '今日' : '月初から現在まで'}</p><strong className="movement-number">{number(estimateEvent(models[k], month, now, period)!)} <small>人</small></strong><p>{intervalLabel(models[k].ratePerSecond, '人')}</p><dl><div><dt>月全体の推計</dt><dd>{number(models[k].estimatedMonthCount)}人</dd></div><div><dt>1日平均</dt><dd>{number(models[k].ratePerSecond * 86400)}人</dd></div></dl></article>)}</div><div className="natural-change"><h3>移動による増減（転入 − 転出）</h3><strong>{signed(MIGRATIONS.reduce((sum, k, i) => sum + (i % 2 ? -1 : 1) * estimateEvent(models[k], month, now, period)!, 0))} 人</strong></div></>}
    <p className="small-note">国内は都道府県間の移動で、県内移動を含みません。全国の国内転入・転出は同じ移動を受入側・送出側から集計した値です。国外は日本人・外国人を含みます。職権消除等を除くため、公式の社会増減数とは異なります。人口カウンターとは独立した推計です。</p>{migration && <><SourceInfo source={migration.domesticSource}/><SourceInfo source={migration.internationalSource}/></>}
  </section>;
}
