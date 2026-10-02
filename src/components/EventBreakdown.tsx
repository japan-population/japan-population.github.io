import type {EventBreakdownData,EventKind} from '../types/statistics';
import {BREAKDOWN_KINDS,BREAKDOWN_LABELS,breakdownCount} from '../lib/event-breakdowns';
import {number} from '../lib/formatting';
import {SourceInfo} from './SourceInfo';
function BreakdownLabel({label}:{label:string}){
  const text=(label==='交通事故'?'交通事故（不慮の事故の内数）':label).replace(/[（(＜<]/g,'（').replace(/[）)＞>]/g,'）');
  return <>{text.split(/(（[^）]*）)/g).map((part,i)=>part.startsWith('（')?<small className="breakdown-parenthesis" key={i}>{part}</small>:part)}</>;
}
export function EventBreakdown({event,sections,total,proxy=false}:{event:EventKind;sections:EventBreakdownData[];total?:number|null;proxy?:boolean}){
  const realtime=total!==undefined,unit=event==='birth'||event==='death'?'人':'組';
  const sources=sections.flatMap(s=>[s.source,...s.additionalSources??[]]).filter((s,i,all)=>all.findIndex(v=>v.url===s.url&&v.sourcePeriod===s.sourcePeriod)===i);
  return <div className="event-breakdown">
    {BREAKDOWN_KINDS[event].map(kind=>{
      const section=sections.find(s=>s.kind===kind);
      return <details className="breakdown-category" key={kind}><summary>{BREAKDOWN_LABELS[kind]}{section&&(!realtime||kind!=='cause'&&kind!=='birthOrder')&&<small>{!realtime&&`${section.year}年`}{kind!=='cause'&&kind!=='birthOrder'?`${realtime?'':' · '}5歳階級`:''}</small>}</summary>
        {!section?<p className="breakdown-note">この年・区分の内訳は未収録です。</p>:<>
          {kind!=='cause'&&section.note&&section.note!=='届出時の年齢。'&&<p className="breakdown-note">{section.note}</p>}
          {kind==='cause'&&<p className="breakdown-note">死因上位{section.items.filter(i=>i.rank).length}項目 ＋ 追加項目</p>}
          <table className="breakdown-table"><thead><tr><th scope="col">区分</th><th scope="col">{realtime?(proxy?'参考推計':'推計'):'人数・件数'}</th><th scope="col">全体比</th></tr></thead><tbody>
            {section.items.map(item=>{const v=breakdownCount(section,item.count,total??undefined);return <tr key={item.label} className={item.supplement?'breakdown-supplement':undefined}>
              <th scope="row"><span className="breakdown-bar" style={{width:`${Math.min(100,v.percent)}%`}}/><span className="breakdown-row-label">{item.rank&&<small className="breakdown-rank">{item.rank}</small>}<BreakdownLabel label={item.label}/></span></th>
              <td>{total===null?'—':`${item.approximate?'約':''}${number(v.count)}`}<small>{unit}</small></td><td>{v.percent.toFixed(1)}<small>%</small></td>
            </tr>;})}
          {kind==='cause'&&['交通事故','自殺','他殺'].filter(name=>!section.items.some(i=>i.label===name)).map(name=><tr key={name}><th scope="row"><BreakdownLabel label={name}/></th><td colSpan={2}>未収録</td></tr>)}
          </tbody></table>
          {section.coverage==='partial'&&kind!=='cause'&&<p className="breakdown-note">全体比はこの年の全件が分母です。表の対象外は内訳に含めていません。</p>}

        </>}
      </details>;
    })}
    {realtime&&sections.length>0&&<p className="breakdown-note">端数処理により内訳の合計が全体と一致しない場合があります。</p>}
    {sources.length>0&&<SourceInfo sources={sources} showPeriod={!realtime}/>}
  </div>;
}
