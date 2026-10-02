import {EVENTS,type AnnualOfficial} from '../types/statistics';
import {EventIcon} from './EventIcon';
import {SourceInfo} from './SourceInfo';
import {number} from '../lib/formatting';
const labels={birth:'出生',death:'死亡',marriage:'婚姻',divorce:'離婚'};
export function AnnualVital({data,total,latest}:{data:AnnualOfficial;total:boolean;latest:boolean}){
  return <details className="annual-vital">
    <summary>年間人口動態 <span>{data.year}年{latest?' · 最新確定年':''}</span></summary>
    <div className="annual-vital-content">
      {total&&<p className="small-note">出生・死亡・婚姻・離婚は日本人のみの統計です。</p>}
      <div className="annual-vital-grid">{EVENTS.map(kind=><article className={`stat-card ${kind}`} key={kind}>
        <div className="card-heading"><EventIcon kind={kind}/><span>{labels[kind]}</span><span className="badge">確定値</span></div>
        <p className="event-value">{number(data.counts[kind])}<small>{kind==='birth'||kind==='death'?'人':'組'}</small></p>
      </article>)}</div>
      <SourceInfo source={data.source}/>
    </div>
  </details>;
}
