import type {WorldGdp} from '../types/world-map';
import type {CSSProperties} from 'react';
import {number} from '../lib/formatting';
export function MapStatsTooltip({name,population,populationTotal,areaKm2,areaReference=false,populationDate,areaDate,populationEstimate=false,gdp,closeLabel,onClose,style}:{name:string;population:number|null;populationTotal?:number;areaKm2:number|null;areaReference?:boolean;populationDate:string;areaDate:string;populationEstimate?:boolean;gdp?:WorldGdp|null;closeLabel:string;onClose:()=>void;style:CSSProperties}){
 const share=population!==null&&populationTotal!==undefined&&Number.isFinite(populationTotal)&&populationTotal>0?population/populationTotal*100:null;
 const gdpShare=gdp?gdp.usd/gdp.worldUsd*100:null;
 const gdpAmount=gdp?`${(gdp.usd/(gdp.usd>=1e12?1e12:1e8)).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1})}${gdp.usd>=1e12?'兆':'億'}米ドル`:null;
 const density=population!==null&&areaKm2!==null?population/areaKm2:null;
 return <div className="municipal-tooltip" role="status" style={style}>
  <button type="button" aria-label={closeLabel} onClick={onClose}>×</button><h4>{name}</h4>
  <p className="municipal-population">{population===null?'データなし':number(population)}{population!==null&&<small>人</small>}{share!==null&&<span className="map-population-share" aria-label={`世界人口の${share.toFixed(1)}%`}>（{share.toFixed(1)}%）</span>}</p>
  <dl><div><dt>面積</dt><dd>{areaKm2===null?'データなし':areaKm2.toLocaleString('ja-JP',{maximumFractionDigits:2,minimumFractionDigits:2})}{areaKm2!==null&&<small>km²</small>}{areaReference&&<small>（参考値）</small>}</dd></div>
  <div><dt>人口密度</dt><dd>{density===null?'データなし':density.toLocaleString('ja-JP',{maximumFractionDigits:1})}{density!==null&&<small>人/km²</small>}</dd></div>{gdp!==undefined&&<div><dt>名目GDP</dt><dd>{gdpAmount??'データなし'}{gdpShare!==null&&<span className="map-population-share" aria-label={`世界GDPの${gdpShare.toFixed(1)}%`}>（{gdpShare.toFixed(1)}%）</span>}</dd></div>}</dl>
  <p className="municipal-tooltip-date">人口{populationEstimate?'（推計）':''} {populationDate.replaceAll('-','/')}<br/>面積 {areaDate.replaceAll('-','/')}{gdp&&<><br/>GDP {gdp.year}年</>}</p>
 </div>;
}
