import {useState} from 'react';
import type {RegionalDetail as Detail,PopulationGroup} from '../types/statistics';
import {PopulationPyramid} from './PopulationPyramid';
import {EventIcon} from './EventIcon';
import {SourceInfo} from './SourceInfo';
import {number} from '../lib/formatting';
export type RegionalAccordionProps={pyramidOpen?:boolean;annualOpen?:boolean;onPyramidToggle?:(open:boolean)=>void;onAnnualToggle?:(open:boolean)=>void};
export function RegionalDetail({data,group,name,pyramidOpen,annualOpen,onPyramidToggle,onAnnualToggle}:{data:Detail;group:PopulationGroup;name:string}&RegionalAccordionProps){
  const [interval,setInterval]=useState<5|10>(5);
  const migration=data.annual.migration[group];
  const vital=group==='foreign'?undefined:data.annual.japanese;
  const cards=[['birth','出生',vital?.birth,'人'],['death','死亡',vital?.death,'人'],['inflow','転入',migration.domesticIn+migration.internationalIn,'人'],['outflow','転出',migration.domesticOut+migration.internationalOut,'人'],['marriage','婚姻',vital?.marriage,'組'],['divorce','離婚',vital?.divorce,'組']] as const;
  return <div className="regional-detail">
    <details className="official-pyramid" open={pyramidOpen} onToggle={e=>onPyramidToggle?.(e.currentTarget.open)}><summary>{name}の人口ピラミッド</summary><PopulationPyramid rows={data.rows.filter(r=>r.group===group)} label={name} interval={interval} onIntervalChange={setInterval} historical regional/></details>
    <details className="annual-vital" open={annualOpen} onToggle={e=>onAnnualToggle?.(e.currentTarget.open)}><summary>{name}の年間人口動態 <span>{data.annual.year}年 · 最新確定年</span></summary><div className="annual-vital-content">
      {group==='total'&&<p className="small-note">出生・死亡・婚姻・離婚は日本人のみの統計です。</p>}
      <div className="annual-vital-grid">{cards.map(([kind,label,value,unit])=><article className={`stat-card ${kind}`} key={kind}><div className="card-heading"><EventIcon kind={kind}/><span>{label}</span>{value!==undefined&&<span className="badge">確定値</span>}</div><p className="event-value">{value===undefined?'データなし':<>{number(value)}<small>{unit}</small></>}</p></article>)}</div>
      <p className="small-note">転入・転出は他都道府県と国外との住所移転です。</p>
      <SourceInfo sources={[...(group==='foreign'?[]:[data.annual.vitalSource]),data.annual.domesticSource,data.annual.internationalSource]}/>
    </div></details>
  </div>;
}
