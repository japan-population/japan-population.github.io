import {memo,useEffect,useRef,useState} from 'react';
import {worldMapSchema,type WorldMapData} from '../types/world-map';
import {MapStatsTooltip} from './MapStatsTooltip';
import {SourceInfo} from './SourceInfo';
import {number} from '../lib/formatting';
import worldPopulation from '../data/world-population.json';
import {clampMapViewport,zoomMapViewport,type MapViewport} from '../lib/map-viewport';
const dimensions={width:1200,height:600};
let cached:WorldMapData|undefined;
export function WorldMapView({data}:{data:WorldMapData}){
 const frame=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<string>(),[hovered,setHovered]=useState<string>();
 const [viewport,setViewport]=useState<MapViewport>({x:0,y:0,zoom:1});
 const [dragging,setDragging]=useState(false);
 const drag=useRef<{id:number;x:number;y:number;viewport:MapViewport;width:number;height:number}|undefined>(undefined);
 const dragged=useRef(false);
 const {zoom}=viewport;
 function changeZoom(next:number){
  setViewport(v=>zoomMapViewport(v,next,dimensions));setSelected(undefined);setHovered(undefined);
 }
 const [anchor,setAnchor]=useState({x:.5,y:.5});
 const [size,setSize]=useState({width:1200,height:600});
 useEffect(()=>{const node=frame.current!;const observer=new ResizeObserver(()=>setSize({width:node.clientWidth,height:node.clientHeight}));observer.observe(node);return()=>observer.disconnect();},[]);
 const worldTotal=worldPopulation.points.find(p=>p.date.slice(0,10)===data.populationDate)?.population;
 const chosen=data.countries.find(c=>c.code===selected),hover=data.countries.find(c=>c.code===hovered);
 function select(code:string,target:SVGGraphicsElement,point?:{x:number;y:number}){
  const root=frame.current!.getBoundingClientRect(),box=target.getBoundingClientRect();
  setAnchor({x:((point?.x??box.x+box.width/2)-root.x)/root.width,y:((point?.y??box.y+box.height/2)-root.y)/root.height});
  setSelected(code);
 }
 return <>
  <div className="world-map-controls municipal-panel-heading">
   <div className="municipal-zoom" role="group" aria-label="世界地図の拡大・縮小">
    <button type="button" aria-label="縮小" disabled={zoom===1} onClick={()=>changeZoom(zoom/2)}>−</button>
    <button type="button" aria-label="拡大" disabled={zoom===256} onClick={()=>changeZoom(zoom*2)}>＋</button>
   </div>
  </div>
  <div className={`world-map-frame${zoom>1?' is-zoomed':''}${dragging?' is-dragging':''}`} ref={frame} onKeyDown={e=>{if(e.key==='Escape'){setSelected(undefined);e.stopPropagation();}}}>
   <svg viewBox={`${viewport.x} ${viewport.y} ${1200/zoom} ${600/zoom}`}
    onPointerDown={e=>{
     dragged.current=false;if(zoom===1||!e.isPrimary||e.button!==0)return;
     const box=e.currentTarget.getBoundingClientRect();
     drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,viewport,width:box.width,height:box.height};
    }}
    onPointerMove={e=>{
     const start=drag.current;if(!start||start.id!==e.pointerId)return;
     const dx=e.clientX-start.x,dy=e.clientY-start.y;
     if(!dragged.current&&Math.hypot(dx,dy)<4)return;
     if(!dragged.current){
      dragged.current=true;e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);setSelected(undefined);setHovered(undefined);
     }
     setViewport(clampMapViewport({zoom:start.viewport.zoom,
      x:start.viewport.x-dx*1200/start.viewport.zoom/start.width,
      y:start.viewport.y-dy*600/start.viewport.zoom/start.height},dimensions));
    }}
    onPointerUp={e=>{
     if(drag.current?.id===e.pointerId){
      drag.current=undefined;setDragging(false);
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
     }
    }}
    onPointerLeave={()=>{if(!dragged.current)drag.current=undefined;}}
    onPointerCancel={()=>{drag.current=undefined;setDragging(false);}}
    onLostPointerCapture={()=>{drag.current=undefined;setDragging(false);}}
    onClickCapture={e=>{if(dragged.current&&e.detail!==0){e.preventDefault();e.stopPropagation();}}}
    role="group" aria-label="国・地域別人口地図" onClick={e=>{if(e.target===e.currentTarget)setSelected(undefined);}}>
    {data.countries.map(c=><path key={c.code} d={c.d} fill={c.fill} fillRule="evenodd" role="button" tabIndex={0} aria-pressed={selected===c.code} aria-label={`${c.name} ${c.population===null?'人口データなし':number(c.population)+'人'}`} onClick={e=>select(c.code,e.currentTarget,e.detail?{x:e.clientX,y:e.clientY}:undefined)} onMouseEnter={()=>setHovered(c.code)} onMouseLeave={()=>setHovered(undefined)} onFocus={()=>setHovered(c.code)} onBlur={()=>setHovered(undefined)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(c.code,e.currentTarget);}}}/>)}
    {hover&&hover.code!==selected&&<path className="world-map-outline" d={hover.d} aria-hidden="true"/>}
    {chosen&&<path className="world-map-outline" d={chosen.d} aria-hidden="true"/>}
   </svg>
   {chosen&&<MapStatsTooltip name={chosen.name} population={chosen.population} populationTotal={worldTotal} gdp={chosen.gdp} areaKm2={chosen.areaKm2} areaReference={chosen.areaReference} populationDate={data.populationDate} areaDate={chosen.areaYear?`${chosen.areaYear}年`:'データなし'} populationEstimate closeLabel="国の情報を閉じる" onClose={()=>setSelected(undefined)} style={{left:Math.max(0,Math.min(size.width-240,anchor.x*size.width-120)),top:Math.max(8,Math.min(size.height-275,anchor.y*size.height-265))}}/>}
  </div>
  <p className="world-map-credit">地図：<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a></p>
  <SourceInfo sources={data.sources} showPeriod={false}/>
 </>;
}
function WorldMap(){
 const host=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false),[data,setData]=useState(cached),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'300px'});observer.observe(host.current!);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!visible||cached){if(cached)setData(cached);return;}
  const controller=new AbortController();setError(false);
  fetch(`${import.meta.env.BASE_URL}maps/world.json`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Map unavailable');const parsed=worldMapSchema.parse(await r.json());cached=parsed;setData(parsed);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[visible,retry]);
 return <div ref={host} className="world-map-host">{data?<WorldMapView data={data}/>:<>
  <img className="world-map" src={`${import.meta.env.BASE_URL}maps/world.svg`} alt="国・地域の人口が多いほど明るい緑で示した、太平洋中心の世界地図" width="1200" height="600" loading="lazy"/>
  {error&&<p className="small-note">国の情報を読み込めませんでした。<button type="button" onClick={()=>setRetry(n=>n+1)}>再読み込み</button></p>}
 </>}</div>;
}
export default memo(WorldMap);
