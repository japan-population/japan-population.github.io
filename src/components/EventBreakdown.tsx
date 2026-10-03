import type {EventBreakdownData,EventKind} from '../types/statistics';
import {BREAKDOWN_KINDS,BREAKDOWN_LABELS,breakdownCount} from '../lib/event-breakdowns';
import {number} from '../lib/formatting';
import {SourceInfo} from './SourceInfo';
function BreakdownLabel({label}:{label:string}){
  const text=label.replace(/[（(＜<]/g,'（').replace(/[）)＞>]/g,'）');
  return <>{text.split(/(（[^）]*）)/g).map((part,i)=>part.startsWith('（')?<small className="breakdown-parenthesis" key={i}>{part}</small>:part)}</>;
}
export function EventBreakdown({event,sections,total,proxy=false,referenceYear}:{event:EventKind;sections:EventBreakdownData[];total?:number|null;proxy?:boolean;referenceYear?:number}){
  const realtime=total!==undefined,unit='人';
  const sources=sections.flatMap(s=>[s.source,...s.additionalSources??[]]).filter((s,i,all)=>all.findIndex(v=>v.url===s.url&&v.sourcePeriod===s.sourcePeriod)===i);
  return <div className="event-breakdown">
    {BREAKDOWN_KINDS[event].map(kind=>{
      const section=sections.find(s=>s.kind===kind);
      const items=kind==='cause'&&section?[
        ...section.items.filter(item=>!item.supplement&&item.label!=='交通事故'),
        ...['自殺','他殺'].filter(label=>!section.items.some(item=>item.label===label&&!item.supplement)).map(label=>section.items.find(item=>item.label===label)??{label,count:null}),
      ]:section?.items??[];
      return <details className="breakdown-category" key={kind}><summary>{BREAKDOWN_LABELS[kind]}{section&&referenceYear!==undefined&&section.year<referenceYear&&<small>{section.year}年</small>}</summary>
        {!section?<p className="breakdown-note">—</p>:<>
          <table className="breakdown-table"><thead><tr><th scope="col">区分</th><th scope="col">{realtime?(proxy?'参考推計':'推計'):'人数'}</th><th scope="col">全体比</th></tr></thead><tbody>
            {items.map(item=>{if(item.count===null)return <tr key={item.label}><th scope="row"><BreakdownLabel label={item.label}/></th><td colSpan={2}>未収録</td></tr>;const v=breakdownCount(section,item.count,total??undefined);
              if(item.label==='不慮の事故'||item.label.startsWith('悪性新生物'))return <tr key={item.label} className="cause-row"><td colSpan={3}>
                <details className="cause-details" data-cause={item.label==='不慮の事故'?'accident':'cancer'}><summary><span>{item.rank&&<small className="breakdown-rank">{item.rank}</small>}<BreakdownLabel label={item.label}/></span><span>{total===null?'—':number(v.count)}<small>人</small></span><span>{v.percent.toFixed(1)}<small>%</small></span></summary>
                  {item.children?<table className="breakdown-table cause-table"><tbody>{[...item.children].sort((a,b)=>b.count-a.count).map(child=>{const c=breakdownCount(section,child.count,total??undefined);return <tr key={child.label}><th scope="row"><BreakdownLabel label={child.label}/></th><td>{total===null?'—':number(c.count)}<small>人</small></td><td>{c.percent.toFixed(1)}<small>%</small></td></tr>;})}</tbody></table>:<p className="breakdown-note">—</p>}
                </details>
              </td></tr>;
              return <tr key={item.label} className={item.supplement?'breakdown-supplement':undefined}>
              <th scope="row"><span className="breakdown-bar" style={{width:`${Math.min(100,v.percent)}%`}}/><span className="breakdown-row-label">{item.rank&&<small className="breakdown-rank">{item.rank}</small>}<BreakdownLabel label={item.label}/></span></th>
              <td>{total===null?'—':`${item.approximate?'約':''}${number(v.count)}`}<small>{unit}</small></td><td>{v.percent.toFixed(1)}<small>%</small></td>
            </tr>;})}
          </tbody></table>

        </>}
      </details>;
    })}
    {sources.length>0&&<SourceInfo sources={sources} showPeriod={!realtime}/>}
  </div>;
}
