import type { Prefecture as PrefectureData } from '../types/statistics';
import { VitalSection } from '../components/VitalSection';
import { RegionSelector } from '../components/RegionSelector';
import { ReferencePopulation } from '../components/ReferencePopulation';
import { dateTime } from '../lib/formatting';
export function Prefecture({ prefecture, now }: { prefecture: PrefectureData; now: number }) {
  return <><section className="prefecture-hero"><a className="back" href="#/">← 全国に戻る</a><div className="eyebrow">PREFECTURE / {prefecture.code}</div><h1>{prefecture.name}<span>の人口動態</span></h1><p className="clock">{dateTime(now)} 現在 · JST</p><p>地域の出生・死亡・婚姻・離婚を、統計に基づくペースで推計します。</p></section><ReferencePopulation population={prefecture.population} now={now}/><VitalSection vital={prefecture.vital} migration={prefecture.migration} now={now} name={prefecture.name}/><RegionSelector selected={prefecture.code}/></>;
}
