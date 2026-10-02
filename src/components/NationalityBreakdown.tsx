import type { Nationalities } from '../types/statistics';
import { number,monthLabel } from '../lib/formatting';
import { SourceInfo } from './SourceInfo';
export function NationalityBreakdown({data,historical=false,open,onOpenChange}:{data?:Nationalities;historical?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void}){
  const sorted=[...(data?.items??[])].sort((a,b)=>b.value-a.value);
  const largest=Math.max(1,sorted[0]?.value??0);
  return <details className="nationality-breakdown" aria-label="外国人の国籍内訳" open={open} onToggle={e=>{if(e.target===e.currentTarget)onOpenChange?.(e.currentTarget.open);}}>
    <summary>国籍内訳</summary><div className="nationality-content">{data?<>
    <div className="nationality-heading"><span>{monthLabel(data.source.sourcePeriod)}1日現在 · 国勢調査</span></div>
    <p className="nationality-total">外国人人口 <strong>{number(data.total)}</strong> 人{data.populationTotal!==undefined&&<> <small aria-label="総人口に占める割合">{(data.total/data.populationTotal*100).toFixed(1)}%</small></>}</p>
    {!historical&&<p className="small-note">上の月次人口とは基準日・集計方法が異なります。</p>}
    <ol className="nationality-bars">{sorted.slice(0,8).map(item=><li key={item.code}><div><span>{item.name}</span><span><strong>{number(item.value)}</strong> 人 <small>{(item.value/data.total*100).toFixed(1)}%</small></span></div><div className="nationality-track" aria-hidden="true"><span style={{width:`${item.value/largest*100}%`}}/></div></li>)}</ol>
    <details className="age-details"><summary>すべての国籍内訳を見る</summary><table className="pyramid-table"><caption>外国人の国籍内訳（人）</caption><thead><tr><th scope="col">国籍・区分</th><th scope="col">人口</th><th scope="col">構成比</th></tr></thead><tbody>{sorted.map(item=><tr key={item.code}><th scope="row">{item.name}</th><td>{number(item.value)}</td><td>{(item.value/data.total*100).toFixed(1)}%</td></tr>)}</tbody></table></details>
    <SourceInfo source={data.source}/>
    </>:<p className="small-note">データ更新後に表示します。</p>}</div>
  </details>;
}
