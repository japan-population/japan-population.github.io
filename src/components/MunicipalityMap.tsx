import {clampMapViewport,zoomMapViewport,mapScale,type MapViewport} from '../lib/map-viewport';
import {memo,useEffect,useState,useRef} from 'react';
import {municipalityMapSchema,type MunicipalityMapData} from '../types/municipalities';
import {SourceInfo} from './SourceInfo';
import {number} from '../lib/formatting';
const cache=new Map<string,MunicipalityMapData>();
function MunicipalityMap({code,name}:{code:string;name:string}){
 const [data,setData]=useState<MunicipalityMapData|undefined>(()=>cache.get(code));
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(cache.has(code)){setData(cache.get(code));return;}
  const controller=new AbortController();setError(false);setData(undefined);
  fetch(`${import.meta.env.BASE_URL}maps/municipalities/${code}.json`,{signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error();const page=municipalityMapSchema.parse(await r.json());if(page.prefectureCode!==code)throw Error();cache.set(code,page);setData(page);})
   .catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[code,retry]);
 const page=data?.prefectureCode===code?data:undefined;
 return <div className="municipal-section" aria-label={`${name}の市区町村地図`}>
  <div className="municipal-heading"><h3>{name}の市区町村</h3><span className="badge">総人口</span></div>
  {!page?<p className="small-note" role="status">{error?<>地図を読み込めませんでした。<button type="button" onClick={()=>setRetry(n=>n+1)}>再読み込み</button></>:'地図を読み込み中…'}</p>:<>
   <p className="small-note municipal-date">人口：{page.populationDate.replaceAll('-','/')}現在</p>
   <div className={`municipal-panels ${page.panels.length>1?'has-islands':''}`}>
    {page.panels.map(panel=><MunicipalPanel key={`${code}-${panel.id}`} panel={panel} data={page}/>)}
   </div>
   <SourceInfo sources={[...page.sources,{...page.sources[1],publisher:'国土交通省・共同通信社',statistics:'行政区域データ',table:'2025年版・本サイト加工',sourcePeriod:'2025-01',publishedAt:'2025',url:page.boundary.url,scope:page.boundary.credit}]}/>
   <p className="municipal-credit"><a href={page.boundary.url} target="_blank" rel="noreferrer">国土数値情報「行政区域データ（2025年）」</a> · <a href="https://github.com/kyodo-official/japan-choropleth" target="_blank" rel="noreferrer">共同通信社加工</a> · <a href={page.boundary.license} target="_blank" rel="noreferrer">CC BY 4.0</a></p>
  </>}
 </div>;
}
export default memo(MunicipalityMap);
function MunicipalPanel({panel,data}:{panel:MunicipalityMapData['panels'][number];data:MunicipalityMapData}){
 const [selected,setSelected]=useState<string>(),[hovered,setHovered]=useState<string>();
 const [viewport,setViewport]=useState<MapViewport>(panel.initialViewport);
 const zoom=viewport.zoom;
 const scale=mapScale(panel.kilometersPerUnit,zoom);
 const [dragging,setDragging]=useState(false);
 const drag=useRef<{id:number;x:number;y:number;viewport:MapViewport;width:number;height:number}|undefined>(undefined);
 const dragged=useRef(false);
 const changeZoom=(zoom:number)=>{setViewport(v=>zoomMapViewport(v,zoom));setSelected(undefined);setHovered(undefined);};
 const [anchor,setAnchor]=useState({x:50,y:50});
 const container=useRef<HTMLDivElement>(null);
 const stats=new Map(data.municipalities.map(m=>[m.code,m]));
 const populations=data.municipalities.map(m=>m.population),min=Math.min(...populations),max=Math.max(...populations);
 const selectedPath=panel.paths.find(p=>p.code===selected),hoveredPath=panel.paths.find(p=>p.code===hovered);
 const chosen=selected?stats.get(selected):undefined;
 const select=(code:string,target:SVGGraphicsElement)=>{
  const box=target.getBoundingClientRect(),root=container.current!.getBoundingClientRect();
  setAnchor({x:Math.max(0,Math.min(root.width-240,box.x-root.x+box.width/2-120)),y:Math.max(8,Math.min(root.height-210,box.y-root.y+box.height/2-190))});
  setSelected(code);
 };
 return <div className="municipal-panel">
  <div className="municipal-panel-heading">{panel.label&&<h4>{panel.label}</h4>}<div className="municipal-zoom" role="group" aria-label={`${panel.label||data.prefectureName}の地図拡大`}><button type="button" aria-label="縮小" disabled={zoom===1} onClick={()=>{changeZoom(zoom/2);}}>−</button><button type="button" aria-label="拡大" disabled={zoom===256} onClick={()=>{changeZoom(zoom*2);}}>＋</button></div></div>
  <div ref={container} className="municipal-map-frame" onKeyDown={e=>{if(e.key==='Escape'){setSelected(undefined);e.stopPropagation();}}}>
   <div className={`municipal-map-scroll ${zoom>1?'is-zoomed':''} ${dragging?'is-dragging':''}`}>
    <svg viewBox={`${viewport.x} ${viewport.y} ${800/zoom} ${480/zoom}`}
     onPointerDown={e=>{
      dragged.current=false;if(zoom===1||!e.isPrimary||e.button!==0)return;
      const box=e.currentTarget.getBoundingClientRect();
      drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,viewport,width:box.width,height:box.height};
     }}
     onPointerMove={e=>{
      const start=drag.current;if(!start||start.id!==e.pointerId)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;
      if(!dragged.current&&Math.hypot(dx,dy)<4)return;
      if(!dragged.current){dragged.current=true;e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);setSelected(undefined);setHovered(undefined);}
      setViewport(clampMapViewport({zoom:start.viewport.zoom,x:start.viewport.x-dx*800/start.viewport.zoom/start.width,y:start.viewport.y-dy*480/start.viewport.zoom/start.height}));
     }}
     onPointerUp={e=>{if(drag.current?.id===e.pointerId){drag.current=undefined;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}
     onPointerLeave={()=>{if(!dragged.current)drag.current=undefined;}}
     onPointerCancel={()=>{drag.current=undefined;setDragging(false);}}
     onLostPointerCapture={()=>{drag.current=undefined;setDragging(false);}}
     onClickCapture={e=>{if(dragged.current&&e.detail!==0){e.preventDefault();e.stopPropagation();}}} role="group" aria-label={`${data.prefectureName}${panel.label} 市区町村人口地図`} onClick={e=>{if(e.target===e.currentTarget)setSelected(undefined);}}>
     {panel.paths.map(p=>{const m=stats.get(p.code)!;const light=25+55*(Math.log1p(m.population)-Math.log1p(min))/Math.max(.001,Math.log1p(max)-Math.log1p(min));const fill=`hsl(151 24% ${light}%)`;
      const events={role:'button',tabIndex:0,'aria-pressed':selected===p.code,'aria-label':`${m.name} ${number(m.population)}人`,onMouseEnter:()=>setHovered(p.code),onMouseLeave:()=>setHovered(undefined),onFocus:()=>setHovered(p.code),onBlur:()=>setHovered(undefined),onClick:(e:React.MouseEvent<SVGGraphicsElement>)=>select(p.code,e.currentTarget),onKeyDown:(e:React.KeyboardEvent<SVGGraphicsElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.code,e.currentTarget);}}};
      return <path key={p.code} d={p.d} fillRule="evenodd" fill={fill} {...events}/>;
     })}
     {hoveredPath&&hovered!==selected&&<g aria-hidden="true"><path className="municipal-outline" d={hoveredPath.d}/></g>}
     {selectedPath&&<g aria-hidden="true"><path className="municipal-outline" d={selectedPath.d}/></g>}
    </svg>
   </div>
   <div className="municipal-scale" style={{width:`${scale.widthPercent}%`}} aria-label={`縮尺 約${scale.label}`}><span>約{scale.label}</span><i aria-hidden="true"/></div>
   {chosen&&<div className="municipal-tooltip" role="status" style={{left:anchor.x,top:anchor.y}}><button type="button" aria-label="市区町村の情報を閉じる" onClick={()=>setSelected(undefined)}>×</button><h4>{chosen.name}</h4><p className="municipal-population">{number(chosen.population)}<small>人</small></p><dl><div><dt>面積</dt><dd>{chosen.areaKm2.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2})}<small>km²</small>{chosen.areaReference&&<small>（参考値）</small>}</dd></div><div><dt>人口密度</dt><dd>{(chosen.population/chosen.areaKm2).toLocaleString('ja-JP',{maximumFractionDigits:1})}<small>人/km²</small></dd></div></dl><p className="municipal-tooltip-date">人口 {data.populationDate.replaceAll('-','/')}<br/>面積 {data.areaDate.replaceAll('-','/')}</p></div>}
  </div>
 </div>;
}
