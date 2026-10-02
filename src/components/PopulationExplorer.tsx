import {useId,useState} from 'react';
import {NationalityBreakdown} from './NationalityBreakdown';
import {AnnualVital} from './AnnualVital';
import {CENSUS_YEARS,type National,type PopulationGroup} from '../types/statistics';
import {SourceInfo} from './SourceInfo';
import {PopulationPyramid} from './PopulationPyramid';
import {number} from '../lib/formatting';
import {GROUP_LABELS} from '../lib/groups';
import {officialView,type OfficialSelection} from '../lib/official-view';
export function PopulationExplorer({national,group,demo}:{national:National;group:PopulationGroup;demo:boolean}){
  const [selection,setSelection]=useState<OfficialSelection>('latest');
  const id=useId(),view=officialView(national,group,selection);
  const options=[...CENSUS_YEARS,'latest'] as const;
  const index=selection==='latest'?11:CENSUS_YEARS.indexOf(selection);
  const date=view.date.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/,'$1年$2月$3日');
  const share=group==='foreign'&&view.population!==undefined&&view.total&&view.total>0?(view.population/view.total*100).toFixed(1):undefined;
  return <section id="official" className="section official-section">
    <div className="section-heading"><div><span className="eyebrow">OFFICIAL STATISTICS</span><h2>過去確定値 <small>{GROUP_LABELS[group]}</small></h2></div></div>
    <div className="official-timeline">
      <label htmlFor={`${id}-year`}>{selection==='latest'?'最新確定値':`${selection}年 国勢調査`}</label>
      <input id={`${id}-year`} type="range" min="0" max="11" step="1" value={index}
        aria-label="過去確定値の年を選択" aria-valuetext={selection==='latest'?'最新確定値':`${selection}年 国勢調査`}
        onChange={e=>setSelection(options[Number(e.currentTarget.value)])}/>
      <div className="timeline-labels">{options.map((year,i)=><button type="button" key={year} aria-pressed={selection===year} aria-label={year==='latest'?'最新確定値を表示':`${year}年の国勢調査を表示`} onClick={()=>setSelection(year)} className={i%2===1&&year!=='latest'?'minor-year':undefined}>{year==='latest'?'最新':year}</button>)}</div>
      <p className="official-date"><time dateTime={view.date}>{date}現在</time></p>
    </div>
    <div className="official-summary">
      <div><span>{demo?'デモの基準人口':selection==='latest'?'最新公式確定値':'国勢調査人口'}</span><strong>{view.population!==undefined?number(view.population):'—'} <small>人</small>{share!==undefined&&<> <small aria-label="総人口に占める割合">{share}%</small></>}</strong></div>
      {(['male','female'] as const).map((sex,i)=><div key={sex}><span>{i===0?'男性':'女性'}</span><strong>{view[sex]!==undefined?(view[sex]/10000).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'} <small>万人</small></strong></div>)}
    </div>
    {view.population===undefined&&selection!=='latest'&&<p className="small-note">この年の{GROUP_LABELS[group]}の人口内訳は未収録です。</p>}
    {view.source&&<SourceInfo source={view.source}/>}
    {view.rows.length>0&&<div className="official-pyramid"><PopulationPyramid key={`${selection}/${group}`} rows={view.rows} label={GROUP_LABELS[group]} historical={selection!=='latest'}/>{view.ageSource&&<SourceInfo source={view.ageSource}/>}</div>}
    {group!=='foreign'&&view.annual&&<AnnualVital key={`${selection}/${group}`} data={view.annual} total={group==='total'} latest={selection==='latest'}/>}
    {group==='foreign'&&selection==='latest'&&<NationalityBreakdown data={national.nationalities}/>}
  </section>;
}
