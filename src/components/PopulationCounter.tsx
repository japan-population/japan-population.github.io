import type { Population } from '../types/statistics';
import { estimateCounter } from '../lib/estimate';
import { dateTime, intervalLabel, number, signed } from '../lib/formatting';
export function PopulationCounter({ population: p, now, demo, label = '総人口' }: { population: Population; now: number; demo: boolean; label?: string }) {
  const value = estimateCounter({ baseValue: p.base, baseTimestamp: Date.parse(p.baseDate), ratePerSecond: p.ratePerSecond }, now);
  const stale = now - Date.parse(p.baseDate) > 366 * 86400000;
  return <section className="population-hero" aria-labelledby="population-title">
    <div className="hero-eyebrow"><span className="eyebrow">JAPAN POPULATION CLOCK</span><span className="live-label"><i aria-hidden="true"/><span>JST · 毎秒更新</span></span></div>
    <div className="hero-title"><h1 id="population-title">日本の現在推計人口<span className="population-kind">{label}</span></h1><span className="badge">{demo ? 'デモ推計' : '推計'}</span></div>
    <div className="population-number" aria-live="off">{number(value)}<span>人</span></div>
    <p className="clock">{dateTime(now)} 現在 <span>日本標準時</span></p>
    <div className="population-stats"><div><span>1日あたりの推計変化</span><strong>{signed(p.ratePerSecond * 86400)}<small> 人 / 日</small></strong></div><div><span>1時間あたり</span><strong>{signed(p.ratePerSecond * 3600)}<small> 人 / 時間</small></strong></div><div><span>人口変化のペース</span><strong className="pace">{intervalLabel(Math.abs(p.ratePerSecond), '人')}<small> {p.ratePerSecond < 0 ? '減少' : p.ratePerSecond > 0 ? '増加' : ''}</small></strong></div></div>
    <div className="hero-bottom"><p>総務省統計局「人口推計」の最新確定値を基に、<br className="desktop-break"/>直近12か月の変化率から現在時刻まで推計しています。{demo && <b> 現在は架空のデモ値です。</b>}</p></div>
    {stale && <p className="warning">基準人口が1年以上前のため、推計の不確実性が大きくなっています。</p>}
  </section>;
}
