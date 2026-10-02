import {trendX,trendMonth,nearestTimelineIndex} from '../lib/population-trend';
import {PopulationTrendChart} from './PopulationTrendChart';
import {useState} from 'react';
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
  const [nationalityOpen,setNationalityOpen]=useState(false);
  const [ageInterval,setAgeInterval]=useState<5|10>(5);
  const [annualOpen,setAnnualOpen]=useState(false),[pyramidOpen,setPyramidOpen]=useState(false);
  const view=officialView(national,group,selection);
  const options=[...CENSUS_YEARS,'latest'] as const;
  const index=selection==='latest'?11:CENSUS_YEARS.indexOf(selection);
  const latestDate=national.populationTrend?.points.at(-1)?.date??national.population.baseDate.slice(0,10);
  const dates=options.map(y=>y==='latest'?latestDate:`${y}-10-01`);
  const offsets=dates.map(d=>trendMonth(d)-trendMonth(dates[0]));
  const date=view.date.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/,'$1年$2月$3日');
  const share=group==='foreign'&&view.population!==undefined&&view.total&&view.total>0?(view.population/view.total*100).toFixed(1):undefined;
  return <section id="official" className="section official-section">
    <div className="section-controls official-controls"><div className="section-heading"><div><span className="eyebrow">OFFICIAL STATISTICS</span><h2>過去確定値 <small>{GROUP_LABELS[group]}</small></h2></div></div>
    <div className="official-timeline">
      <p className="official-date"><time dateTime={view.date}>{date}現在</time></p>
      <input className="historical-range" type="range" min="0" max={offsets.at(-1)} step="any" value={offsets[index]}
        aria-label="過去確定値の年を選択" aria-valuetext={selection==='latest'?'最新確定値':`${selection}年 国勢調査`}
        onChange={e=>setSelection(options[nearestTimelineIndex(offsets,Number(e.currentTarget.value))])}
        onKeyDown={e=>{const direction=['ArrowRight','ArrowUp'].includes(e.key)?1:['ArrowLeft','ArrowDown'].includes(e.key)?-1:0;if(direction||e.key==='Home'||e.key==='End'){e.preventDefault();setSelection(options[e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+direction))]);}}}/>
      <div className="timeline-labels historical-labels">{options.map((year,i)=><button type="button" key={year} style={{left:`${trendX(dates[i],latestDate)}%`}} aria-pressed={selection===year} aria-label={year==='latest'?'最新確定値を表示':`${year}年の国勢調査を表示`} onClick={()=>setSelection(year)} className={i%2===1&&year!=='latest'?'minor-year':undefined}>{year==='latest'?'最新':year}</button>)}</div>
    </div>
    </div>
    {national.populationTrend&&<PopulationTrendChart data={national.populationTrend} selection={selection}/>}
    <div className="official-summary">
      <div><span>{demo?'デモの基準人口':selection==='latest'?'最新公式確定値':view.derivation?'参考推計':view.referenceNote?'参考値（公表概数）':'国勢調査人口'}</span><strong>{view.population!==undefined?`${view.referenceNote&&!view.derivation?'約 ':''}${number(view.population)}`:'—'} <small>人</small>{share!==undefined&&<> <small aria-label="総人口に占める割合">{share}%</small></>}</strong></div>
      {(['male','female'] as const).map((sex,i)=><div key={sex}><span>{i===0?'男性':'女性'}</span><strong>{view[sex]!==undefined?(view[sex]/10000).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'} <small>万人</small></strong></div>)}
    </div>
    {view.population===undefined&&selection!=='latest'&&<p className="small-note">この年の{GROUP_LABELS[group]}の人口内訳は未収録です。</p>}
    {group==='foreign'&&selection!=='latest'&&selection<=1940&&<p className="small-note">戦前の値は、当時の内地の外地人を含む区分です。</p>}
    {view.referenceNote&&<p className="small-note">{view.referenceNote}</p>}
    {view.derivation?<SourceInfo sources={view.derivation.sources}/>:view.source&&<SourceInfo source={view.source}/>}
    <details className="official-pyramid" open={pyramidOpen} onToggle={e=>{if(e.target===e.currentTarget)setPyramidOpen(e.currentTarget.open);}}><summary>人口ピラミッド</summary>{view.rows.length>0?<><PopulationPyramid key={`${selection}/${group}`} rows={view.rows} interval={ageInterval} onIntervalChange={setAgeInterval} label={GROUP_LABELS[group]} historical={selection!=='latest'} ageExclusion={view.ageExclusion}/>{view.ageSource&&<SourceInfo sources={[view.ageSource,...view.ageSupportingSources??[]]}/>}</>:<p className="small-note pyramid-unavailable">この年の国籍別・年齢階級別人口は未収録です。</p>}</details>
    {group!=='foreign'&&view.annual&&<AnnualVital breakdowns={national.eventBreakdowns} open={annualOpen} onOpenChange={setAnnualOpen} data={view.annual} total={group==='total'} latest={selection==='latest'}/>}
    {group==='foreign'&&<NationalityBreakdown open={nationalityOpen} onOpenChange={setNationalityOpen} data={view.nationalities} historical={selection!=='latest'}/>}
  </section>;
}
