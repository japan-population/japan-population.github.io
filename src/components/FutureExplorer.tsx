import {TimelineSlider} from './TimelineSlider';
import {useState,type CSSProperties} from 'react';
import type {PopulationGroup,PopulationTrend} from '../types/statistics';
import {PROJECTION_SCENARIOS,PROJECTION_LABELS,type Projections,type ProjectionScenario} from '../types/projections';
import {futureYears,projectionView,projectionSources} from '../lib/projections';
import {GROUP_LABELS} from '../lib/groups';
import {number} from '../lib/formatting';
import {PopulationPyramid} from './PopulationPyramid';
import {PopulationTrendChart} from './PopulationTrendChart';
import {EventIcon} from './EventIcon';
export function FutureExplorer({data,group,now}:{data:Projections;group:PopulationGroup;now:number}){
 const [scenario,setScenario]=useState<ProjectionScenario>('medium'),[selected,setSelected]=useState(2030);
 const [interval,setInterval]=useState<5|10>(5),[pyramidOpen,setPyramidOpen]=useState(false),[annualOpen,setAnnualOpen]=useState(false);
 const years=futureYears(now);if(!years.length)return null;
 const year=years.includes(selected)?selected:years[0],view=projectionView(data,scenario,year,group),record=data.scenarios[scenario];
 const trend:PopulationTrend={sources:projectionSources(data,scenario),points:record.points.filter(p=>p.year>=years[0]).map(p=>({date:`${p.year}-10-01`,total:p.population.total,japanese:p.population.japanese,foreign:p.population.total-p.population.japanese,precision:1,sourceIndex:0}))};
 return <section id="future" className="section official-section future-section" style={{'--timeline-count':years.length} as CSSProperties}>
  <div className="section-controls official-controls">
   <div className="section-heading"><div><span className="eyebrow">POPULATION PROJECTIONS</span><h2>未来予測値 <small>{GROUP_LABELS[group]}</small></h2></div>
    <div className="segmented projection-switch" role="group" aria-label="将来推計のシナリオ">{PROJECTION_SCENARIOS.map(s=><button key={s} aria-pressed={scenario===s} onClick={()=>setScenario(s)}>{PROJECTION_LABELS[s]}</button>)}</div>
   </div>
   <div className="official-timeline"><p className="official-date"><time dateTime={`${year}-10-01`}>{year}年10月1日現在</time></p>
    <TimelineSlider min="0" max={years.length-1} step="1" value={years.indexOf(year)} disabled={years.length===1} aria-label="未来予測値の年を選択" aria-valuetext={`${year}年`} onChange={e=>setSelected(years[Number(e.currentTarget.value)])}/>
    <div className="timeline-labels">{years.map(y=><button type="button" key={y} aria-label={`${y}年の将来推計を表示`} aria-pressed={year===y} onClick={()=>setSelected(y)}>{y}</button>)}</div>
   </div>
  </div>
  <PopulationTrendChart key={years[0]} data={trend} selection={year} years={years} notes={<>
   <p>社人研の令和5年推計（2020年国勢調査基準）。出生高位・中位・低位はいずれも死亡中位で、発生確率や予測の上下限ではありません。2071年以降は長期参考推計です。</p>
   <p>外国人人口は、同じ仮定の総人口から日本人人口を差し引いています。国際人口移動は短期滞在者を除き、2041年以降は人口規模に連動する入国超過率を使用。出生・死亡・国籍変更も公的モデルの仮定に従います。外国人割合の固定上限を設けたモデルではありません。</p>
   <p>公表表の千人単位・小数第3位を人に換算しています。丸めにより男女・年齢の内訳合計に差が生じます。将来の政策・経済状況の変化を確定的に予測するものではありません。<a href={data.methodUrl} target="_blank" rel="noreferrer">推計方法と仮定</a></p>
  </>}/>
  <p className="small-note projection-caption">社人研 令和5年推計 · {PROJECTION_LABELS[scenario]}・死亡中位{year>2070?' · 長期参考推計':''}</p>
  <div className="official-summary">
   <div><span>{group==='foreign'?'参考予測人口':year>2070?'長期参考推計人口':'将来推計人口'}</span><strong>{number(view.population)} <small>人</small>{group==='foreign'&&<small aria-label="総人口に占める割合"> {(view.population/view.total*100).toFixed(1)}%</small>}</strong></div>
   {(['male','female'] as const).map((sex,i)=><div key={sex}><span>{i===0?'男性':'女性'}</span><strong>{(view[sex]/10000).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1})} <small>万人</small></strong></div>)}
  </div>
  <details className="official-pyramid" open={pyramidOpen} onToggle={e=>{if(e.target===e.currentTarget)setPyramidOpen(e.currentTarget.open);}}><summary>人口ピラミッド</summary><PopulationPyramid key={`${year}/${scenario}/${group}`} rows={view.rows} interval={interval} onIntervalChange={setInterval} label={GROUP_LABELS[group]}/></details>
  <details className="annual-vital" open={annualOpen} onToggle={e=>{if(e.target===e.currentTarget)setAnnualOpen(e.currentTarget.open);}}><summary>年間人口動態 <span>{year}年 · 予測</span></summary><div className="annual-vital-content">
   <div className="annual-vital-grid">{(['birth','death'] as const).map(kind=><article key={kind} className={`stat-card ${kind}`}><div className="card-heading"><EventIcon kind={kind}/><span>{kind==='birth'?'出生':'死亡'}</span><span className="badge">予測</span></div><p className="event-value">{number(view[kind])}<small>人</small></p></article>)}</div>
   <p className="small-note">婚姻・離婚は、この公的推計の公表対象外です。</p>
  </div></details>
 </section>;
}
