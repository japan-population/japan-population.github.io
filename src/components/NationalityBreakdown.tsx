import type { Nationalities } from '../types/statistics';
import { number,monthLabel } from '../lib/formatting';
import { SourceInfo } from './SourceInfo';
export function NationalityBreakdown({data}:{data?:Nationalities}){
  if(!data)return <section className="nationality-breakdown"><h3>国籍内訳</h3><p className="small-note">データ更新後に表示します。</p></section>;
  const sorted=[...data.items].sort((a,b)=>b.value-a.value);
  const largest=Math.max(1,sorted[0].value);
  return <section className="nationality-breakdown" aria-label="外国人の国籍内訳">
    <div className="nationality-heading"><h3>国籍内訳</h3><span>{monthLabel(data.source.sourcePeriod)}1日現在 · 国勢調査</span></div>
    <p className="nationality-total">外国人人口 <strong>{number(data.total)}</strong> 人</p>
    <p className="small-note">上の月次人口とは基準日・集計方法が異なります。</p>
    <ol className="nationality-bars">{sorted.slice(0,8).map(item=><li key={item.code}><div><span>{item.name}</span><span><strong>{number(item.value)}</strong> 人 <small>{(item.value/data.total*100).toFixed(1)}%</small></span></div><div className="nationality-track" aria-hidden="true"><span style={{width:`${item.value/largest*100}%`}}/></div></li>)}</ol>
    <details className="age-details"><summary>すべての国籍内訳を見る</summary><table className="pyramid-table"><caption>外国人の国籍内訳（人）</caption><thead><tr><th scope="col">国籍・区分</th><th scope="col">人口</th><th scope="col">構成比</th></tr></thead><tbody>{sorted.map(item=><tr key={item.code}><th scope="row">{item.name}</th><td>{number(item.value)}</td><td>{(item.value/data.total*100).toFixed(1)}%</td></tr>)}</tbody></table></details>
    <SourceInfo source={data.source}/>
  </section>;
}
