import {useState} from 'react';
import type {RegionalSnapshot,RegionalMetric} from '../types/regional-timeline';
import type {PopulationGroup} from '../types/statistics';
import {PopulationPyramid} from './PopulationPyramid';
import {SourceInfo} from './SourceInfo';
import {EventIcon} from './EventIcon';
import {number,signed} from '../lib/formatting';
export function RegionalSnapshotIndicators({snapshot,group,tokyo=false}:{snapshot:RegionalSnapshot;group:PopulationGroup;tokyo?:boolean}){
 const g=snapshot.groups[group];
 const note=(v:RegionalMetric|undefined,japanese=false)=>v?`${v.migrationCoverage==='domestic-japanese'?'国内・日本人 · ':v.migrationCoverage==='domestic'?'国内 · ':japanese&&group==='total'?'日本人 · ':''}${v.calculation?.method==='single-year'?`${v.calculation.startYear}.10–${String(v.calculation.endYear).slice(2)}.9`:v.calculation?`${v.calculation.startYear}–${String(v.calculation.endYear).slice(2)}年平均`:`${v.source.sourcePeriod.slice(0,4)}年`}${v.estimateKind==='residual'?' · 残差推計':v.reference?' · 参考値':''}`:'';
 const metric=(v:RegionalMetric|undefined,unit:string,digits=0,sign=false)=>v?<>{sign?signed(v.value):v.value.toLocaleString('ja-JP',{minimumFractionDigits:digits,maximumFractionDigits:digits})}<small>{unit}</small></>:<small>データなし</small>;
 return <div className="map-indicators">
  <div><span>平均年齢<small>{note(g?.averageAge)}</small></span><strong>{metric(g?.averageAge,'歳',1)}</strong></div>
  <div className="regional-area"><span>面積{snapshot.area?.reference?<small>{snapshot.area.source.sourcePeriod.slice(0,4)}年 · 参考値</small>:snapshot.status!=='final'&&<small>{snapshot.area?.source.sourcePeriod.slice(0,4)}年の面積</small>}</span><strong>{metric(snapshot.area,'km²',2)}</strong></div>
  <div className="regional-density"><span>人口密度{(group!=='total'||snapshot.density?.reference)&&<small>{[group!=='total'?'総人口':'',snapshot.density?.reference?'参考値':''].filter(Boolean).join(' · ')}</small>}</span><strong>{metric(snapshot.density,'人/km²',1)}</strong></div>
  <div className="regional-migration-change"><span>移動による増減<small>{note(g?.migrationChange)}</small></span><strong>{metric(g?.migrationChange,'人',0,true)}</strong></div>
  <div className="regional-natural-change"><span>自然増減<small>{note(g?.naturalChange,!tokyo||g?.naturalChange?.source.scope.includes('日本における日本人'))}</small></span><strong>{metric(g?.naturalChange,'人',0,true)}</strong></div>
  <div><span>合計特殊出生率<small>{note(g?.fertilityRate,true)}</small></span><strong>{metric(g?.fertilityRate,'',2)}</strong></div>
 </div>;
}
export function RegionalSnapshotDetail({snapshot,group,name,year,tokyo=false}:{tokyo?:boolean;snapshot?:RegionalSnapshot;group:PopulationGroup;name:string;year:number}){
 const [interval,setInterval]=useState<5|10>(5);
 const g=snapshot?.groups[group],rows=g?.rows??[];
 const events=g?.events;const eventYears=tokyo?[...new Set(Object.values(events??{}).map(v=>v.source.sourcePeriod.slice(0,4)))].sort().join('・'):String(year);const projection=snapshot?.status!=='final';
 return <div className="regional-detail">
  <details className="official-pyramid"><summary>人口ピラミッド{g?.pyramidReference&&<small className="regional-reference-label">参考値</small>}</summary>{rows.some(r=>r.age!=='総数')?<PopulationPyramid rows={rows} label={name} interval={interval} onIntervalChange={setInterval} historical regional/>:<p className="small-note">データなし</p>}</details>
  <details className="annual-vital"><summary>年間人口動態 <span>{eventYears||year}年{projection?' · 予測':''}</span></summary><div className="annual-vital-content">
   {group==='total'&&events&&['birth','death','marriage','divorce'].some(k=>events[k as keyof typeof events])&&<p className="small-note">{tokyo&&!events.birth?.source.scope.includes('日本における日本人')?'婚姻・離婚は日本人のみの統計です。':'出生・死亡・婚姻・離婚は日本人のみの統計です。'}</p>}
   <div className="annual-vital-grid">{(['birth','death','inflow','outflow','marriage','divorce']as const).map((kind,i)=>{const v=events?.[kind];return <article className={`stat-card ${kind}`} key={kind}><div className="card-heading"><EventIcon kind={kind}/><span>{['出生','死亡','転入','転出','婚姻','離婚'][i]}</span>{v&&<span className="badge">{v.reference?'参考推計':projection?'予測':v.source.status==='provisional'?'公式概数':'確定値'}</span>}</div><p className="event-value">{v?<>{number(v.value)}<small>{i>3?'組':'人'}</small></>:'データなし'}</p>{tokyo&&v&&<p className="small-note">{v.source.sourcePeriod.slice(0,4)}年</p>}</article>;})}</div>
   {events&&(events.inflow||events.outflow)&&<p className="small-note">{tokyo?'転入・転出は都内の他地域、他道府県及び国外との住所移転です。':events.inflow?.migrationCoverage==='domestic-japanese'?'転入・転出は日本人の他都道府県との住所移転です。':'転入・転出は他都道府県と国外との住所移転です。'}</p>}
   {events&&Object.values(events).length>0&&<SourceInfo sources={Object.values(events).map(v=>v.source)}/>}
  </div></details>
 </div>;
}
