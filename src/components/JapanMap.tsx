import {RegionalYearSlider} from './RegionalYearSlider';
import {regionalYearSchema,REGIONAL_PAST_YEARS,REGIONAL_FUTURE_YEARS,type RegionalTimeline} from '../types/regional-timeline';
import {RegionalSnapshotDetail,RegionalSnapshotIndicators} from './RegionalSnapshotDetail';
import {regionalSources} from '../lib/regional-view';
import type {CSSProperties} from 'react';
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
  const [period,setPeriod]=useState<'past'|'latest'|'future'>('latest');
  const [pastYear,setPastYear]=useState(2020),[futureYear,setFutureYear]=useState(2030);
  const [timeline,setTimeline]=useState<{generationId:string;data:RegionalTimeline}>();
  const [timelineError,setTimelineError]=useState('');
  const year=period==='past'?pastYear:futureYear;
  const years=period==='past'?REGIONAL_PAST_YEARS:REGIONAL_FUTURE_YEARS;
  useEffect(()=>{
    if(period==='latest'||period==='future'&&year>2050||timeline?.generationId===data.manifest.generationId&&timeline.data[period][year])return;
    const controller=new AbortController();setTimelineError('');
    fetch(`${import.meta.env.BASE_URL}data/regional/${period}-${year}.json`,{cache:'no-cache',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error();const raw=await r.json();if(raw.generationId!==data.manifest.generationId)throw Error();const page=regionalYearSchema.parse(raw);if(page.period!==period||page.year!==year)throw Error();return page;})
      .then(value=>setTimeline(previous=>{const dataByYear=previous?.generationId===data.manifest.generationId?previous.data:{past:{},future:{}};return {generationId:data.manifest.generationId,data:{...dataByYear,[value.period]:{...dataByYear[value.period],[value.year]:value.regions}}};}))
      .catch(()=>{if(!controller.signal.aborted)setTimelineError('地域の時系列データを読み込めませんでした。再読み込みしてください。');});
    return()=>controller.abort();
  },[period,year,data.manifest.generationId,timeline]);
  const records=period!=='latest'&&timeline?.generationId===data.manifest.generationId?timeline.data[period][year]:undefined;
  const [selected,setSelected]=useState<string>();
  const [details,setDetails]=useState<{generationId:string;regions:Record<string,Detail>}>();
  const [error,setError]=useState('');
  useEffect(()=>{
    if(period!=='latest'||!selected||details?.generationId===data.manifest.generationId)return;
    const controller=new AbortController();setError('');
    fetch(`${import.meta.env.BASE_URL}data/region-details.json`,{cache:'no-cache',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('地域の詳細を読み込めませんでした。');return regionalDetailsSchema.parse(await response.json());})
      .then(value=>{if(value.generationId!==data.manifest.generationId)throw new Error('データ更新中です。再読み込みしてください。');setDetails(value);})
      .catch((e:unknown)=>{if(!controller.signal.aborted)setError(e instanceof Error&&e.message.includes('データ更新中')?e.message:'地域の詳細を読み込めませんでした。再読み込みしてください。');});
    return()=>controller.abort();
  },[period,Boolean(selected),data.manifest.generationId,details?.generationId]);
  const detail=selected&&details?.generationId===data.manifest.generationId?details.regions[selected]:undefined;
  const snapshot=selected?records?.[selected]:undefined;
  const get=(code:string)=>period==='latest'?data.prefectures[code]?.officialPopulation?.[group]:records?.[code]?.groups[group]?.population;
  const values=map.paths.map(p=>get(p.code)?.value).filter((v):v is number=>v!==undefined), max=Math.max(1,...values),min=Math.min(...values);
  const source=period==='latest'?Object.values(data.prefectures).map(p=>p.officialPopulation?.[group]?.source).find(Boolean):Object.values(records??{}).map(p=>p.groups[group]?.population?.source).find(Boolean);
  const census=source?.statistics.includes('国勢調査');
  const chosen=selected?get(selected):undefined;
  return <section id="regions" className="section regional-section" style={{'--timeline-count':years.length} as CSSProperties}><div className="section-controls official-controls"><div className="section-heading section-switch-heading"><div><span className="eyebrow">PREFECTURES</span><h2>地域別に見る <small>{GROUP_LABELS[group]}</small></h2></div><div className="segmented" role="group" aria-label="地域の表示時点">{(['past','latest','future'] as const).map((p,i)=><button type="button" key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{['過去','最新','未来'][i]}</button>)}</div></div>{period!=='latest'&&<RegionalYearSlider period={period} year={year} onChange={period==='past'?setPastYear:setFutureYear}/>}</div>{period!=='latest'&&!(period==='future'&&year>2050)&&!records&&<p className="small-note" role="status">{timelineError||'読み込み中…'}</p>}{period==='future'&&<p className="small-note">{year<=2050?'社人研 令和5年推計 · 総人口':'この年の公的な地域別推計はありません。'}{group!=='total'?' · 日本人・外国人別の公的推計はありません。':''}</p>}<div className="japan-map" onKeyDown={e=>{if(e.key==='Escape')setSelected(undefined);}}>
    <svg viewBox={map.viewBox} preserveAspectRatio="xMidYMax meet" role="group" aria-label="都道府県別人口地図">{map.paths.map(p=>{const v=get(p.code);const light=v?25+55*(Math.log1p(v.value)-Math.log1p(min))/Math.max(.001,Math.log1p(max)-Math.log1p(min)):65;return <path key={p.code} d={p.d} fill={v?`hsl(151 24% ${light}%)`:'#d4d8d5'} role="button" tabIndex={0} aria-label={`${p.name} ${v?number(v.value)+'人':'データなし'}`} aria-pressed={selected===p.code} onClick={()=>setSelected(p.code)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.code);}}}/>;})}</svg>
    {selected&&<div className="map-selection" aria-live="polite">
      <h3>{data.prefectures[selected]?.name}</h3><p className="map-population">{chosen?number(chosen.value):'データなし'}{chosen&&<small>人</small>}</p><p className="map-date">{chosen?`${monthLabel(chosen.source.sourcePeriod)}1日現在`:period!=='latest'?`${year}年10月1日現在`:''}{chosen&&'reference'in chosen&&chosen.reference?' · 参考値':''}</p><div className="map-sex">{(['男','女'] as const).map(sex=><div key={sex}><span>{sex}性</span><strong>{(()=>{const value=period==='latest'?detail?.rows.find(r=>r.group===group&&r.sex===sex&&r.age==='総数')?.value:snapshot?.groups[group]?.[sex==='男'?'male':'female']?.value;return value===undefined?<small>データなし</small>:<>{number(value)}<small>人</small></>;})()}</strong></div>)}</div>{period==='latest'?detail&&<RegionalIndicators data={detail} group={group}/>:snapshot&&<RegionalSnapshotIndicators snapshot={snapshot} group={group}/>}
    </div>}
    </div>{selected&&(period!=='latest'?<RegionalSnapshotDetail snapshot={snapshot} year={year} group={group} name={data.prefectures[selected].name}/>:detail?<RegionalDetail data={detail} group={group} name={data.prefectures[selected].name}/>:<p className="small-note" role="status">{error||'読み込み中…'}</p>)}{period==='latest'&&!census&&group==='foreign'&&<p className="small-note">外国人人口は公表された総人口と日本人人口の差です。</p>}<details className="method-details"><summary>地図・統計の出典</summary>{source&&<><p>{source?.publisher}「{source?.statistics}」{source?.table}</p><p>{source?.scope}</p><p>公表日：{source?.publishedAt}</p><a href={source?.url}>公式統計表</a></>}{period==='latest'&&detail&&(detail.indicators||detail.geography)&&<SourceInfo sources={[...(detail.indicators?[detail.indicators.averageAge.source,...(group==='foreign'?[]:[detail.indicators.birthRate.source])]:[]),...(detail.geography?[detail.geography.source]:[])]}/>}{period!=='latest'&&regionalSources(snapshot,group).length>0&&<SourceInfo sources={regionalSources(snapshot,group)}/>}<p>地図は現在の都道府県境を簡略化して表示しています。<a href="https://github.com/lalamalink/japan-map-svg">lalamalink / CC0</a></p></details></section>;
}
