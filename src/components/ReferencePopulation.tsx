import type { ReferencePopulation as Model } from '../types/statistics';
import { monthKey, monthStart } from '../lib/time';
import { estimateCounter } from '../lib/estimate';
import { number, signed, monthLabel } from '../lib/formatting';
import { SourceInfo } from './SourceInfo';
export function ReferencePopulation({ population: p, now }: { population?: Model; now: number }) {
  if (!p) return <p className="small-note">都道府県人口は、拡張データの初回更新後に表示します。</p>;
  const month = monthKey(now); const model = p.months[month];
  return <section className="population-hero"><div className="hero-title"><h2>現在の参考推計人口</h2><span className="badge">参考推計</span></div>{model ? <><div className="population-number" aria-live="off">{number(estimateCounter({ ...model, baseTimestamp: monthStart(month) }, now))}<span>人</span></div><p>1日あたりの推計変化 {signed(model.ratePerSecond * 86400)}人</p></> : <p className="warning">今月の推計モデルがありません。データの更新が必要です。</p>}<p>最新公式人口：{monthLabel(p.source.sourcePeriod)}1日　<strong>{number(p.officialBase)}人</strong>（公表単位：千人）</p><p>公式人口に、出生 − 死亡 ＋ 国内転入 − 国内転出 ＋ 国外転入 − 国外転出を加減しています。未公表月は季節性と最近の傾向から推計しています。</p><p className="small-note">出生・死亡は日本人、人口移動は外国人を含む統計です。外国人の出生・死亡や職権消除等を反映していないため、総人口の整合した推計ではありません。全国人口との合計も一致しません。</p><SourceInfo source={p.source}/><SourceInfo source={p.vitalSource}/><SourceInfo source={p.domesticSource}/><SourceInfo source={p.internationalSource}/></section>;
}
