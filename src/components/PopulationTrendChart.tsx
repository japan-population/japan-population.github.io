import {useState,type ReactNode} from 'react';
import type {PopulationTrend} from '../types/statistics';
import {CENSUS_YEARS} from '../types/statistics';
import {number} from '../lib/formatting';
import {trendPaths,trendX,trendY} from '../lib/population-trend';
import {SourceInfo} from './SourceInfo';

export function PopulationTrendChart({data,selection,years,notes}:{data:PopulationTrend;selection:number|'latest';years?:number[];notes?:ReactNode}){
  const [hover,setHover]=useState<number>();
  const points=data.points,latest=points.at(-1)!;
  const position=(date:string)=>years?((Number(date.slice(0,4))-years[0])/10+.5)/years.length*100:trendX(date,latest.date);
  const paths=trendPaths(points,position);
  const selected=selection==='latest'?points.length-1:points.findIndex(p=>Number(p.date.slice(0,4))===selection);
  const index=hover??Math.max(0,selected),point=points[index],x=position(point.date);
  const ticks=Array.from({length:4},(_,i)=>paths.maximum*i/3);
  const move=(clientX:number,element:HTMLElement)=>{
    const rect=element.getBoundingClientRect(),pointerPosition=(clientX-rect.left)/rect.width*100;
    setHover(points.reduce((closest,p,i)=>Math.abs(position(p.date)-pointerPosition)<Math.abs(position(points[closest].date)-pointerPosition)?i:closest,0));
  };
  return <div className="population-trend">
    <div className="trend-heading"><h3>総人口の推移</h3><div className="trend-legend"><span><i className="trend-japanese-key"/>日本人</span><span><i className="trend-foreign-key"/>外国人</span>{points.some(p=>p.japanese===undefined)&&<span><i className="trend-unknown-key"/>内訳未収録</span>}</div></div>
    <div className="trend-plot" role="group" tabIndex={0} aria-label="総人口の年次推移。左右矢印キーで各年の人数を確認できます。"
      onPointerMove={e=>move(e.clientX,e.currentTarget)} onPointerLeave={e=>{if(e.pointerType==='mouse')setHover(undefined);}}
      onClick={e=>move(e.clientX,e.currentTarget)} onFocus={()=>setHover(Math.max(0,selected))} onBlur={()=>setHover(undefined)}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setHover(Math.max(0,Math.min(points.length-1,index+(e.key==='ArrowRight'?1:-1))));}else if(e.key==='Escape')setHover(undefined);}}>
      <svg viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden="true">
        {ticks.map(t=><line key={t} x1={position(points[0].date)*12} x2={position(latest.date)*12} y1={trendY(t,paths.maximum)} y2={trendY(t,paths.maximum)} className={t===0?'trend-baseline':'trend-grid'}/>)}
        <path d={paths.area} className="trend-total-area"/>
        {paths.japanese.map((d,i)=><path key={i} d={d} className="trend-japanese-area"/>)}
        {paths.foreign.map((d,i)=><path key={i} d={d} className="trend-foreign-area"/>)}
        <path d={paths.line} className="trend-total-line"/>
        {points.map(p=><line key={p.date} x1={position(p.date)*12} x2={position(p.date)*12} y1="220" y2="224" className="trend-year-tick"/>)}
        <line x1={x*12} x2={x*12} y1="20" y2="220" className="trend-selection"/>
      </svg>
      <div className="trend-dot" style={{left:`${x}%`,top:`${trendY(point.total,paths.maximum)/240*100}%`}}/>
      {ticks.map(t=><span key={t} className="trend-y-label" style={{top:`${trendY(t,paths.maximum)/240*100}%`}}>{t===0?'0人':`${number(t/10000)}万人`}</span>)}
      {hover!==undefined&&<div className="trend-tooltip" style={{left:`clamp(110px, ${x}%, calc(100% - 110px))`}} role="tooltip">
        <strong>{point.date.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/,'$1年$2月$3日')}現在</strong>
        <dl><div><dt>総人口</dt><dd>{number(point.total)}人</dd></div><div><dt>日本人</dt><dd>{point.japanese===undefined?'—':`${point.breakdownReference?'約 ':''}${number(point.japanese)}人`}</dd></div><div><dt>外国人</dt><dd>{point.foreign===undefined?'—':`${point.breakdownReference?'約 ':''}${number(point.foreign)}人`}</dd></div></dl>
        {point.breakdownReference&&<small>内訳は参考値{point.breakdownReference.method==='linear-interpolation'?'（基準年間の補間）':''}</small>}
        <small>{years?'表示単位：人（予測値）':`公表単位：${point.precision===1000?'千人':'人'}`}</small>
      </div>}
    </div>
    <div className="trend-years" style={years?{gridTemplateColumns:`repeat(${years.length},minmax(0,1fr))`}:undefined} aria-hidden="true">{(years??[...CENSUS_YEARS,'最新']).map(year=><span key={year}>{year}</span>)}</div>
    <details className="trend-notes"><summary>グラフのデータ・出典</summary>{notes??<><p>総人口は各年の公表値です。1920〜1949年の内訳は参考値で、1920・1930・1940年の国勢調査の外国人数と1950年の年次内訳を基準に、間の年を直線補間しています。日本人は総人口との差引です。戦前の区分は外地人を含み、戦中・戦後の急変や集計範囲の差を再現するものではありません。1950年以降の外国人人口は、同じ表の総人口から日本人人口を差し引いた値です。日本人人口には国籍不詳の按分・補完値を含みます。</p><p>1940年は補正後の人口、1945年は11月1日現在。1945～1971年は沖縄を含みません。国勢調査の原数値とは一致しない年があります。2020年から最新値までの横幅は、スライダーに合わせて調整しています。</p></>}
      <div className="trend-table-scroll"><table><caption>{years?'年次人口の将来推計（人）':'年次人口（人・参考内訳を含む）'}</caption><thead><tr><th>基準日</th><th>総人口</th><th>日本人</th><th>外国人</th><th>公表単位</th><th>内訳区分</th></tr></thead><tbody>{points.map(p=><tr key={p.date}><th scope="row">{p.date}</th><td>{number(p.total)}</td><td>{p.japanese===undefined?'—':number(p.japanese)}</td><td>{p.foreign===undefined?'—':number(p.foreign)}</td><td>{p.precision===1000?'千人':'人'}</td><td>{p.breakdownReference?'参考値':years?'予測値':'公表値から算出'}</td></tr>)}</tbody></table></div>
      <SourceInfo sources={data.sources}/>
    </details>
  </div>;
}
