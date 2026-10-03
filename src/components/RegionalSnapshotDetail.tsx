import {useState} from 'react';
import type {RegionalSnapshot,RegionalMetric} from '../types/regional-timeline';
import type {PopulationGroup} from '../types/statistics';
import {PopulationPyramid} from './PopulationPyramid';
import {SourceInfo} from './SourceInfo';
import {EventIcon} from './EventIcon';
import {number,signed} from '../lib/formatting';
export function RegionalSnapshotIndicators({snapshot,group}:{snapshot:RegionalSnapshot;group:PopulationGroup}){
 const g=snapshot.groups[group];
 const note=(v:RegionalMetric|undefined,japanese=false)=>v?`${japanese&&group==='total'?'日本人 · ':''}${v.source.sourcePeriod.slice(0,4)}年${v.reference?' · 参考値':''}`:'';
 const metric=(v:RegionalMetric|undefined,unit:string,digits=0,sign=false)=>v?<>{sign?signed(v.value):v.value.toLocaleString('ja-JP',{minimumFractionDigits:digits,maximumFractionDigits:digits})}<small>{unit}</small></>:<small>データなし</small>;
 return <div className="map-indicators">
  <div><span>平均年齢<small>{note(g?.averageAge)}</small></span><strong>{metric(g?.averageAge,'歳',1)}</strong></div>
  <div className="regional-area"><span>面積{snapshot.status!=='final'&&<small>{snapshot.area?.source.sourcePeriod.slice(0,4)}年の面積</small>}</span><strong>{metric(snapshot.area,'km²',2)}</strong></div>
  <div className="regional-density"><span>人口密度{group!=='total'&&<small>総人口</small>}</span><strong>{metric(snapshot.density,'人/km²',1)}</strong></div>
  <div className="regional-migration-change"><span>移動による増減<small>{note(g?.migrationChange)}</small></span><strong>{metric(g?.migrationChange,'人',0,true)}</strong></div>
  <div className="regional-natural-change"><span>自然増減<small>{note(g?.naturalChange,true)}</small></span><strong>{metric(g?.naturalChange,'人',0,true)}</strong></div>
  <div><span>合計特殊出生率<small>{note(g?.fertilityRate,true)}</small></span><strong>{metric(g?.fertilityRate,'',2)}</strong></div>
 </div>;
}
export function RegionalSnapshotDetail({snapshot,group,name,year}:{snapshot?:RegionalSnapshot;group:PopulationGroup;name:string;year:number}){
 const [interval,setInterval]=useState<5|10>(5);
 const g=snapshot?.groups[group],rows=g?.rows??[];
 const events=g?.events;const projection=snapshot?.status!=='final';
 return <div className="regional-detail">
  <details className="official-pyramid"><summary>人口ピラミッド</summary>{rows.some(r=>r.age!=='総数')?<PopulationPyramid rows={rows} label={name} interval={interval} onIntervalChange={setInterval} historical regional/>:<p className="small-note">データなし</p>}</details>
  <details className="annual-vital"><summary>年間人口動態 <span>{year}年{projection?' · 予測':''}</span></summary><div className="annual-vital-content">
   {group==='total'&&events&&['birth','death','marriage','divorce'].some(k=>events[k as keyof typeof events])&&<p className="small-note">出生・死亡・婚姻・離婚は日本人のみの統計です。</p>}
   <div className="annual-vital-grid">{(['birth','death','inflow','outflow','marriage','divorce']as const).map((kind,i)=>{const v=events?.[kind];return <article className={`stat-card ${kind}`} key={kind}><div className="card-heading"><EventIcon kind={kind}/><span>{['出生','死亡','転入','転出','婚姻','離婚'][i]}</span>{v&&<span className="badge">{v.reference?'参考推計':projection?'予測':'確定値'}</span>}</div><p className="event-value">{v?<>{number(v.value)}<small>{i>3?'組':'人'}</small></>:'データなし'}</p></article>;})}</div>
   {events&&(events.inflow||events.outflow)&&<p className="small-note">転入・転出は他都道府県と国外との住所移転です。</p>}
   {events&&Object.values(events).length>0&&<SourceInfo sources={Object.values(events).map(v=>v.source)}/>}
  </div></details>
 </div>;
}
