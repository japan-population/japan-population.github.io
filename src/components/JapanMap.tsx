import {tokyoAreasSchema,tokyoAvailablePastYears,TOKYO_AREA_LABELS,type TokyoAreas,type TokyoArea} from '../types/tokyo-areas';
import {RegionalYearSlider} from './RegionalYearSlider';
import {regionalIndexSchema,regionalYearSchema,REGIONAL_PAST_YEARS,REGIONAL_FUTURE_YEARS,type RegionalTimeline} from '../types/regional-timeline';
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
  const [selected,setSelected]=useState<string>();
  const [pyramidOpen,setPyramidOpen]=useState(false);
  const [annualOpen,setAnnualOpen]=useState(false);
  const accordionProps={pyramidOpen,annualOpen,onPyramidToggle:setPyramidOpen,onAnnualToggle:setAnnualOpen};
  const [hovered,setHovered]=useState<string>();
  const [tokyoArea,setTokyoArea]=useState<TokyoArea|'all'>('all');
  const [tokyo,setTokyo]=useState<{generationId:string;data:TokyoAreas}>();
  const [tokyoError,setTokyoError]=useState('');
  useEffect(()=>{setTokyoArea('all');},[selected]);
  useEffect(()=>{if(selected!=='13'||!data.manifest.tokyoAreas||tokyo?.generationId===data.manifest.generationId)return;const c=new AbortController();setTokyoError('');fetch(`${import.meta.env.BASE_URL}data/tokyo-areas.json`,{cache:'no-cache',signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const raw=await r.json();if(raw.generationId!==data.manifest.generationId)throw Error();setTokyo({generationId:raw.generationId,data:tokyoAreasSchema.parse(raw)});}).catch(()=>{if(!c.signal.aborted)setTokyoError('東京都の地域データを読み込めませんでした。再読み込みしてください。');});return()=>c.abort();},[selected,data.manifest.generationId,data.manifest.tokyoAreas,tokyo?.generationId]);
  const tokyoData=tokyo?.generationId===data.manifest.generationId?tokyo.data:undefined;
  const subarea=selected==='13'&&tokyoArea!=='all'?tokyoArea:undefined;
  const [requestedPeriod,setPeriod]=useState<'past'|'latest'|'future'>('latest');
  const period=requestedPeriod==='future'&&group!=='total'?'latest':requestedPeriod;
  const [availability,setAvailability]=useState<{generationId:string;availablePast:Record<PopulationGroup,number[]>}>();
  useEffect(()=>{const c=new AbortController();fetch(`${import.meta.env.BASE_URL}data/regional-timeline.json`,{cache:'no-cache',signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const index=regionalIndexSchema.parse(await r.json());if(index.generationId!==data.manifest.generationId)throw Error();setAvailability(index);}).catch(()=>{if(!c.signal.aborted)setTimelineError('地域の時系列データを読み込めませんでした。再読み込みしてください。');});return()=>c.abort();},[data.manifest.generationId]);
  const [pastYear,setPastYear]=useState(2020),[futureYear,setFutureYear]=useState(2030);
  const [timeline,setTimeline]=useState<{generationId:string;data:RegionalTimeline}>();
  const [timelineError,setTimelineError]=useState('');
  const availablePast=subarea&&tokyoData?tokyoAvailablePastYears(tokyoData,subarea,group):(availability?.generationId===data.manifest.generationId?availability.availablePast[group]:[]);
  useEffect(()=>{if(requestedPeriod==='past'&&subarea&&tokyoData&&!availablePast.length)setPeriod('latest');},[requestedPeriod,subarea,tokyoData,availablePast.length]);
  const validPastYear=availablePast.includes(pastYear)?pastYear:availablePast.at(-1)??2020;
  const year=period==='past'?validPastYear:futureYear;
  const years=period==='past'?REGIONAL_PAST_YEARS:REGIONAL_FUTURE_YEARS;
  useEffect(()=>{
    if(period==='latest'||period==='past'&&!availablePast.length||timeline?.generationId===data.manifest.generationId&&timeline.data[period][year])return;
    const controller=new AbortController();setTimelineError('');
    fetch(`${import.meta.env.BASE_URL}data/regional/${period}-${year}.json`,{cache:'no-cache',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error();const raw=await r.json();if(raw.generationId!==data.manifest.generationId)throw Error();const page=regionalYearSchema.parse(raw);if(page.period!==period||page.year!==year)throw Error();return page;})
      .then(value=>setTimeline(previous=>{const dataByYear=previous?.generationId===data.manifest.generationId?previous.data:{past:{},future:{}};return {generationId:data.manifest.generationId,data:{...dataByYear,[value.period]:{...dataByYear[value.period],[value.year]:value.regions}}};}))
      .catch(()=>{if(!controller.signal.aborted)setTimelineError('地域の時系列データを読み込めませんでした。再読み込みしてください。');});
    return()=>controller.abort();
  },[period,year,data.manifest.generationId,timeline,availablePast.length]);
  const records=period!=='latest'&&timeline?.generationId===data.manifest.generationId?timeline.data[period][year]:undefined;
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
  const snapshot=subarea?(period==='latest'?tokyoData?.latest[subarea]:tokyoData?.[period][year]?.[subarea]):selected?records?.[selected]:undefined;
  const snapshotView=Boolean(subarea)||period!=='latest';
  const hoveredPath=map.paths.find(p=>p.code===hovered);
  const selectedPath=map.paths.find(p=>p.code===selected);
  const selectedName=selected?`${data.prefectures[selected].name}${subarea?' · '+TOKYO_AREA_LABELS[subarea]:''}`:'';
  const get=(code:string)=>period==='latest'?data.prefectures[code]?.officialPopulation?.[group]:records?.[code]?.groups[group]?.population;
  const values=map.paths.map(p=>get(p.code)?.value).filter((v):v is number=>v!==undefined), max=Math.max(1,...values),min=Math.min(...values);
  const source=period==='latest'?Object.values(data.prefectures).map(p=>p.officialPopulation?.[group]?.source).find(Boolean):Object.values(records??{}).map(p=>p.groups[group]?.population?.source).find(Boolean);
  const census=source?.statistics.includes('国勢調査');
  const chosen=subarea?snapshot?.groups[group]?.population:selected?get(selected):undefined;
  return <section id="regions" className="section regional-section" style={{'--timeline-count':years.length} as CSSProperties}><div className="section-controls official-controls"><div className="section-heading section-switch-heading"><div><span className="eyebrow">PREFECTURES</span><h2>地域別に見る <small>{GROUP_LABELS[group]}</small></h2></div><div className="segmented" role="group" aria-label="地域の表示時点">{(['past','latest','future'] as const).map((p,i)=><button type="button" key={p} aria-pressed={period===p} disabled={p==='future'&&group!=='total'||p==='past'&&Boolean(subarea&&tokyoData)&&!availablePast.length} title={p==='future'&&group!=='total'?'国籍別の地域将来推計はありません':undefined} onClick={()=>setPeriod(p)}>{['過去','最新','未来'][i]}</button>)}</div></div>{period!=='latest'&&<RegionalYearSlider period={period} year={year} availableYears={period==='past'?availablePast:undefined} date={snapshot?.groups[group]?.population?.source.sourcePeriod} onChange={period==='past'?setPastYear:setFutureYear}/>}</div>{period!=='latest'&&!records&&<p className="small-note" role="status">{timelineError||'読み込み中…'}</p>}{period==='future'&&<p className="small-note">{subarea?'独自参考推計 · 東京全域の予測を地域別・男女別・年齢別に配分':year<=2050?'社人研 令和5年推計 · 総人口':'独自参考推計 · 全国中位推計を2050年の地域構成比で配分'}{group!=='total'?' · 日本人・外国人別の公的推計はありません。':''}</p>}<div className="japan-map" onKeyDown={e=>{if(e.key==='Escape')setSelected(undefined);}}>
    <svg viewBox={map.viewBox} preserveAspectRatio="xMidYMax meet" role="group" aria-label="都道府県別人口地図">{map.paths.map(p=>{const v=get(p.code);const light=v?25+55*(Math.log1p(v.value)-Math.log1p(min))/Math.max(.001,Math.log1p(max)-Math.log1p(min)):65;return <path key={p.code} d={p.d} fill={v?`hsl(151 24% ${light}%)`:'#d4d8d5'} role="button" tabIndex={0} aria-label={`${p.name} ${v?number(v.value)+'人':'データなし'}`} aria-pressed={selected===p.code} onMouseEnter={()=>setHovered(p.code)} onMouseLeave={()=>setHovered(undefined)} onClick={()=>setSelected(p.code)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.code);}}}/>;})}{/* Paint interaction outlines above neighboring prefectures, with selection foremost. */}{hoveredPath&&hovered!==selected&&<path className="map-selection-outline" d={hoveredPath.d} aria-hidden="true"/>}{selectedPath&&<path className="map-selection-outline" d={selectedPath.d} aria-hidden="true"/>}</svg>
    {selected&&<div className="map-selection" aria-live="polite">
      <div className="map-card-heading"><h3>{data.prefectures[selected]?.name}</h3>{selected==='13'&&data.manifest.tokyoAreas&&<div className="segmented tokyo-area-switch" role="group" aria-label="東京都の地域">{(['all','wards','tama','islands']as const).map(a=><button type="button" key={a} aria-pressed={tokyoArea===a} onClick={()=>setTokyoArea(a)}>{TOKYO_AREA_LABELS[a]}</button>)}</div>}</div>{subarea&&!snapshot&&<p className="small-note" role="status">{tokyoError||(!tokyoData?'読み込み中…':'この年・区分のデータなし')}</p>}<p className="map-population">{chosen?number(chosen.value):'データなし'}{chosen&&<small>人</small>}</p><p className="map-date">{chosen?`${monthLabel(chosen.source.sourcePeriod)}1日現在`:period!=='latest'?`${year}年10月1日現在`:''}{chosen&&'reference'in chosen&&chosen.reference?' · 参考値':''}</p><div className="map-sex">{(['男','女'] as const).map(sex=><div key={sex}><span>{sex}性</span><strong>{(()=>{const value=!snapshotView?detail?.rows.find(r=>r.group===group&&r.sex===sex&&r.age==='総数')?.value:snapshot?.groups[group]?.[sex==='男'?'male':'female']?.value;return value===undefined?<small>データなし</small>:<>{number(value)}<small>人</small></>;})()}</strong></div>)}</div>{!snapshotView?detail&&<RegionalIndicators data={detail} group={group}/>:snapshot&&<RegionalSnapshotIndicators snapshot={snapshot} group={group} tokyo={Boolean(subarea)}/>}
    </div>}
    </div>{selected&&(snapshotView?<RegionalSnapshotDetail {...accordionProps} snapshot={snapshot} year={period==='latest'?snapshot?.year??year:year} group={group} name={selectedName} tokyo={Boolean(subarea)}/>:detail?<RegionalDetail {...accordionProps} data={detail} group={group} name={data.prefectures[selected].name}/>:<p className="small-note" role="status">{error||'読み込み中…'}</p>)}{period==='latest'&&!census&&group==='foreign'&&<p className="small-note">外国人人口は公表された総人口と日本人人口の差です。</p>}<details className="method-details"><summary>地図・統計の出典</summary>{!subarea&&source&&<><p>{source?.publisher}「{source?.statistics}」{source?.table}</p><p>{source?.scope}</p><p>公表日：{source?.publishedAt}</p><a href={source?.url}>公式統計表</a></>}{!snapshotView&&detail&&(detail.indicators||detail.geography)&&<SourceInfo sources={[...(detail.indicators?[detail.indicators.averageAge.source,...(group==='foreign'?[]:[detail.indicators.birthRate.source])]:[]),...(detail.geography?[detail.geography.source]:[])]}/>}{snapshotView&&regionalSources(snapshot,group).length>0&&<SourceInfo sources={regionalSources(snapshot,group)}/>}<p>地図は現在の都道府県境を簡略化して表示しています。<a href="https://github.com/lalamalink/japan-map-svg">lalamalink / CC0</a></p></details></section>;
}
