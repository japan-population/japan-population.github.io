import {RegionalIndicators} from './RegionalIndicators';
import {SourceInfo} from './SourceInfo';
import { useEffect, useState } from 'react';
import {regionalDetailsSchema,type RegionalDetail as Detail} from '../types/statistics';
import {RegionalDetail} from './RegionalDetail';
import map from '../assets/japan-map.json';
import type { SiteData, PopulationGroup } from '../types/statistics';
import { number, monthLabel } from '../lib/formatting';
import { GROUP_LABELS } from '../lib/groups';
export function JapanMap({data,group}:{data:SiteData;group:PopulationGroup}) {
  const [selected,setSelected]=useState<string>();
  const [details,setDetails]=useState<{generationId:string;regions:Record<string,Detail>}>();
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!selected||details?.generationId===data.manifest.generationId)return;
    const controller=new AbortController();setError('');
    fetch(`${import.meta.env.BASE_URL}data/region-details.json`,{cache:'no-cache',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('地域の詳細を読み込めませんでした。');return regionalDetailsSchema.parse(await response.json());})
      .then(value=>{if(value.generationId!==data.manifest.generationId)throw new Error('データ更新中です。再読み込みしてください。');setDetails(value);})
      .catch((e:unknown)=>{if(!controller.signal.aborted)setError(e instanceof Error&&e.message.includes('データ更新中')?e.message:'地域の詳細を読み込めませんでした。再読み込みしてください。');});
    return()=>controller.abort();
  },[Boolean(selected),data.manifest.generationId,details?.generationId]);
  const detail=selected&&details?.generationId===data.manifest.generationId?details.regions[selected]:undefined;
  const get=(code:string)=>data.prefectures[code]?.officialPopulation?.[group];
  const values=map.paths.map(p=>get(p.code)?.value).filter((v):v is number=>v!==undefined), max=Math.max(1,...values),min=Math.min(...values);
  const source=Object.values(data.prefectures).map(p=>p.officialPopulation?.[group]?.source).find(Boolean);
  const census=source?.statistics.includes('国勢調査');
  const chosen=selected?get(selected):undefined;
  return <section id="regions" className="section"><div className="section-heading section-controls"><div><span className="eyebrow">PREFECTURES</span><h2>地域別に見る <small>{GROUP_LABELS[group]}</small></h2></div></div><p className="small-note">都道府県を選ぶと、最新の公表人口を表示します。</p><div className="japan-map" onKeyDown={e=>{if(e.key==='Escape')setSelected(undefined);}}>
    <svg viewBox={map.viewBox} preserveAspectRatio="xMidYMax meet" role="group" aria-label="都道府県別人口地図">{map.paths.map(p=>{const v=get(p.code);const light=v?25+55*(Math.log1p(v.value)-Math.log1p(min))/Math.max(.001,Math.log1p(max)-Math.log1p(min)):65;return <path key={p.code} d={p.d} fill={v?`hsl(151 24% ${light}%)`:'#d4d8d5'} role="button" tabIndex={0} aria-label={`${p.name} ${v?number(v.value)+'人':'データなし'}`} aria-pressed={selected===p.code} onClick={()=>setSelected(p.code)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.code);}}}/>;})}</svg>
    {selected&&<div className="map-selection" aria-live="polite">
      <h3>{data.prefectures[selected]?.name}</h3><p className="map-population">{chosen?number(chosen.value):'データなし'}{chosen&&<small>人</small>}</p><p className="map-date">{chosen&&`${monthLabel(chosen.source.sourcePeriod)}1日現在`}</p><div className="map-sex">{(['男','女'] as const).map(sex=><div key={sex}><span>{sex}性</span><strong>{detail?number(detail.rows.find(r=>r.group===group&&r.sex===sex&&r.age==='総数')?.value??0):'—'}<small>人</small></strong></div>)}</div>{detail&&<RegionalIndicators data={detail} group={group}/>}
    </div>}
    </div>{selected&&(detail?<RegionalDetail data={detail} group={group} name={data.prefectures[selected].name}/>:<p className="small-note" role="status">{error||'読み込み中…'}</p>)}{!census&&group==='foreign'&&<p className="small-note">外国人人口は公表された総人口と日本人人口の差です。</p>}<details className="method-details"><summary>地図・統計の出典</summary><p>{source?.publisher}「{source?.statistics}」{source?.table}</p><p>{source?.scope}</p><p>公表日：{source?.publishedAt}</p><a href={source?.url??'https://www.e-stat.go.jp/dbview?sid=0003448232'}>公式統計表</a>{detail?.indicators&&<><SourceInfo source={detail.indicators.averageAge.source}/>{group!=='foreign'&&<SourceInfo source={detail.indicators.birthRate.source}/>}</>}{detail?.geography&&<SourceInfo source={detail.geography.source}/>}<p>地図は形状を簡略化しています。<a href="https://github.com/lalamalink/japan-map-svg">lalamalink / CC0</a></p></details></section>;
}
