import { useId, useState } from 'react';
import type { Breakdown } from '../types/statistics';
import { pyramidRows } from '../lib/pyramid';
import { number } from '../lib/formatting';
export function PopulationPyramid({ rows, label, interval, onIntervalChange, historical=false, ageExclusion }: { rows: Breakdown['rows']; label: string; interval:5|10; onIntervalChange:(interval:5|10)=>void; historical?:boolean; ageExclusion?:{fromAge:number;scopeLabel:string} }) {
  const id = useId();
  const [selected, setSelected] = useState<string>();
  const data = pyramidRows(rows, interval);
  const excluded = (age:string) => ageExclusion!==undefined&&parseInt(age)+interval>ageExclusion.fromAge;
  const scope = (age:string) => excluded(age)?(parseInt(age)<ageExclusion!.fromAge?'（85歳以上は沖縄を除く）':`（${ageExclusion!.scopeLabel}）`):'';
  const max = interval === 5 ? 6_000_000 : 12_000_000;
  const unit = 10000;
  const tick = (t: number) => (max * t / unit).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  return <figure className="pyramid"><div className="segmented age-switch" role="group" aria-label="年齢階級の幅">{([5,10] as const).map(n=><button key={n} aria-pressed={interval===n} onClick={()=>{onIntervalChange(n);setSelected(undefined);}}>{n}歳ずつ</button>)}</div><div className="pyramid-legend"><span><i className="male-key"/>男性</span><span><i className="female-key"/>女性</span></div>
    <div className="pyramid-chart" role="group" aria-labelledby={`${id}-title ${id}-desc`}><span className="sr-only" id={`${id}-title`}>{label}の男女・年齢階級別人口</span><span className="sr-only" id={`${id}-desc`}>上が{data[0]?.age}、下が0〜{interval - 1}歳。左が男性、右が女性。同じ目盛りで人口を比較しています。棒に触れるかキーボードで選択すると人数を確認できます。下の数値表にも掲載しています。</span>
      {data.map((row, index) => <div className="pyramid-row" key={row.age}
        onPointerEnter={e => { if (e.pointerType === 'mouse') setSelected(row.age); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setSelected(undefined); }}
        onFocus={() => setSelected(row.age)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSelected(undefined); }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setSelected(undefined); } }}>
        <button type="button" className="pyramid-half male-half" aria-label={`${row.age}${scope(row.age)} 男性 ${number(row.male)}人`} aria-describedby={selected === row.age ? `${id}-tooltip-${index}` : undefined} onClick={() => setSelected(row.age)}><span style={{width: `${row.male / max * 100}%`}}/></button>
        <span className="age-label"><span className="age-label-text">{row.age}{excluded(row.age)&&<sup>※</sup>}</span></span>
        <button type="button" className="pyramid-half female-half" aria-label={`${row.age}${scope(row.age)} 女性 ${number(row.female)}人`} aria-describedby={selected === row.age ? `${id}-tooltip-${index}` : undefined} onClick={() => setSelected(row.age)}><span style={{width: `${row.female / max * 100}%`}}/></button>
        {selected === row.age && <div className="pyramid-tooltip" ><div id={`${id}-tooltip-${index}`} role="tooltip"><strong>{row.age}{scope(row.age)}</strong><span>男性 {number(row.male)}人 ／ 女性 {number(row.female)}人</span><span>男女計 {number(row.total)}人</span></div><button type="button" aria-label="人口の詳細を閉じる" onClick={e => { e.stopPropagation(); setSelected(undefined); }}>×</button></div>}
      </div>)}
      <div className="pyramid-axis"><div>{[1,.5,0].map(t => <span key={t}>{tick(t)}</span>)}</div><span/><div>{[0,.5,1].map(t => <span key={t}>{tick(t)}</span>)}</div></div>
    </div><p className="pyramid-unit">単位：万人</p>
    <details className="age-details"><summary>人口ピラミッドの数値表</summary><table className="pyramid-table"><caption>{label}の年齢階級別人口（人）</caption><thead><tr><th scope="col">年齢</th><th scope="col">男性</th><th scope="col">女性</th><th scope="col">男女計</th></tr></thead><tbody>{data.map(r => <tr key={r.age}><th scope="row">{r.age}{excluded(r.age)&&<sup>※</sup>}</th><td>{number(r.male)}</td><td>{number(r.female)}</td><td>{number(r.total)}</td></tr>)}</tbody></table></details>{ageExclusion&&<p className="small-note">※{ageExclusion.fromAge}歳以上は沖縄のデータを含まない値です。</p>}<p className="small-note">{historical?'年齢不詳はグラフに含めていません。':'各区分の丸めにより、内訳の合計と総数が一致しない場合があります。'}</p>
  </figure>;
}
