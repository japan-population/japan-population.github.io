import { useRef, useState } from 'react';
import map from '../assets/japan-map.json';
import type { SiteData, PopulationGroup } from '../types/statistics';
import { number, monthLabel } from '../lib/formatting';
import { GROUP_LABELS } from '../lib/groups';
export function JapanMap({data,group}:{data:SiteData;group:PopulationGroup}) {
  const box=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState<{code:string;x:number;y:number}>();
  const get=(code:string)=>data.prefectures[code]?.officialPopulation?.[group];
  const values=map.paths.map(p=>get(p.code)?.value).filter((v):v is number=>v!==undefined), max=Math.max(1,...values),min=Math.min(...values);
  const source=Object.values(data.prefectures).map(p=>p.officialPopulation?.[group]?.source).find(Boolean);
  const census=source?.statistics.includes('国勢調査');
  const chosen=selected?get(selected.code):undefined;
  const choose=(code:string,el:SVGPathElement)=>{const r=el.getBoundingClientRect(),b=box.current!.getBoundingClientRect();setSelected({code,x:Math.max(20,Math.min(80,(r.x+r.width/2-b.x)/b.width*100)),y:(r.y+r.height/2-b.y)/b.height*100});};
  return <section id="regions" className="section"><div className="section-heading section-controls"><div><span className="eyebrow">PREFECTURES</span><h2>地域別に見る <small>{GROUP_LABELS[group]}</small></h2></div></div><p className="small-note">都道府県を選ぶと、最新の公表人口を表示します。</p><div className="japan-map" ref={box} onKeyDown={e=>{if(e.key==='Escape')setSelected(undefined);}}>
    <svg viewBox={map.viewBox} role="group" aria-label="都道府県別人口地図">{map.paths.map(p=>{const v=get(p.code);const light=v?25+55*(Math.log1p(v.value)-Math.log1p(min))/Math.max(.001,Math.log1p(max)-Math.log1p(min)):65;return <path key={p.code} d={p.d} fill={v?`hsl(151 24% ${light}%)`:'#d4d8d5'} role="button" tabIndex={0} aria-label={`${p.name} ${v?number(v.value)+'人':'データなし'}`} aria-pressed={selected?.code===p.code} onClick={e=>choose(p.code,e.currentTarget)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(p.code,e.currentTarget);}}}/>;})}</svg>
    {selected&&<div className="map-tooltip" style={{left:`${selected.x}%`,top:`${selected.y}%`}}><div role="status"><strong>{data.prefectures[selected.code]?.name}</strong><span>{chosen?`${number(chosen.value)} 人`:'—'}</span><small>{chosen?`${monthLabel(chosen.source.sourcePeriod)}1日 · ${data.manifest.mode==='fixture'?'デモ値':chosen.derived?'公式値の差から算出':'公式確定値'}`:'この区分のデータはありません'}</small></div><button aria-label="地域の詳細を閉じる" onClick={()=>setSelected(undefined)}>×</button></div>}
    </div><p className="small-note">{census?'':group==='foreign'?'外国人人口は公表された総人口と日本人人口の差です。':''}{census?'公表単位：人。':'公表単位：千人。'}全国の月次人口とは基準日が異なります。</p><details className="method-details"><summary>地図・統計の出典</summary><p>{source?.publisher}「{source?.statistics}」{source?.table}</p><p>{source?.scope}</p><p>公表日：{source?.publishedAt}</p><a href={source?.url??'https://www.e-stat.go.jp/dbview?sid=0003448232'}>公式統計表</a><p>地図は形状を簡略化しています。<a href="https://github.com/lalamalink/japan-map-svg">lalamalink / CC0</a></p></details></section>;
}
