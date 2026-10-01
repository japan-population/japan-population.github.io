import { useId, useState } from 'react';
import type { Breakdown } from '../types/statistics';
import { number } from '../lib/formatting';
export function PopulationPyramid({ rows, label }: { rows: Breakdown['rows']; label: string }) {
  const id = useId();
  const [selected, setSelected] = useState<string>();
  const ages = [...new Set(rows.filter(r => r.age !== '総数').map(r => r.age))].sort((a, b) => parseInt(b) - parseInt(a));
  const data = ages.map(age => ({ age, male: rows.find(r => r.age === age && r.sex === '男')!.value, female: rows.find(r => r.age === age && r.sex === '女')!.value }));
  const largest = Math.max(1, ...data.flatMap(r => [r.male, r.female]));
  const step = 10 ** Math.floor(Math.log10(largest));
  const max = Math.ceil(largest / step) * step;
  const unit = max < 10000 ? 1 : 10000;
  const tick = (t: number) => (max * t / unit).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  return <figure className="pyramid"><figcaption><h3>{label}の人口ピラミッド</h3><p>男性を左、女性を右に表示。棒にカーソルを合わせるかタップすると人数を表示します。左右は同じ目盛りです。</p></figcaption><div className="pyramid-legend"><span><i className="male-key"/>男性</span><span><i className="female-key"/>女性</span></div>
    <div className="pyramid-chart" role="group" aria-labelledby={`${id}-title ${id}-desc`}><span className="sr-only" id={`${id}-title`}>{label}の男女・年齢階級別人口</span><span className="sr-only" id={`${id}-desc`}>上が100歳以上、下が0〜4歳。左が男性、右が女性。同じ目盛りで人口を比較しています。棒に触れるかキーボードで選択すると人数を確認できます。下の数値表にも掲載しています。</span>
      {data.map((row, index) => <div className="pyramid-row" key={row.age}
        onPointerEnter={e => { if (e.pointerType === 'mouse') setSelected(row.age); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setSelected(undefined); }}
        onFocus={() => setSelected(row.age)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSelected(undefined); }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setSelected(undefined); } }}>
        <button type="button" className="pyramid-half male-half" aria-label={`${row.age} 男性 ${number(row.male)}人`} aria-describedby={selected === row.age ? `${id}-tooltip-${index}` : undefined} onClick={() => setSelected(row.age)}><span style={{width: `${row.male / max * 100}%`}}/></button>
        <span className="age-label">{row.age}</span>
        <button type="button" className="pyramid-half female-half" aria-label={`${row.age} 女性 ${number(row.female)}人`} aria-describedby={selected === row.age ? `${id}-tooltip-${index}` : undefined} onClick={() => setSelected(row.age)}><span style={{width: `${row.female / max * 100}%`}}/></button>
        {selected === row.age && <div className="pyramid-tooltip" ><div id={`${id}-tooltip-${index}`} role="tooltip"><strong>{row.age}</strong><span>男性 {number(row.male)}人 ／ 女性 {number(row.female)}人</span></div><button type="button" aria-label="人口の詳細を閉じる" onClick={e => { e.stopPropagation(); setSelected(undefined); }}>×</button></div>}
      </div>)}
      <div className="pyramid-axis"><div>{[1,.5,0].map(t => <span key={t}>{tick(t)}</span>)}</div><span/><div>{[0,.5,1].map(t => <span key={t}>{tick(t)}</span>)}</div></div>
    </div><p className="pyramid-unit">単位：{unit === 1 ? '人' : '万人'}</p>
    <details className="age-details"><summary>人口ピラミッドの数値表</summary><table className="pyramid-table"><caption>{label}の年齢階級別人口（人）</caption><thead><tr><th scope="col">年齢</th><th scope="col">男性</th><th scope="col">女性</th><th scope="col">男女計</th></tr></thead><tbody>{data.map(r => <tr key={r.age}><th scope="row">{r.age}</th><td>{number(r.male)}</td><td>{number(r.female)}</td><td>{number(rows.find(v => v.age === r.age && v.sex === '男女計')!.value)}</td></tr>)}</tbody></table></details><p className="small-note">各区分の丸めにより、内訳の合計と総数が一致しない場合があります。</p>
  </figure>;
}
