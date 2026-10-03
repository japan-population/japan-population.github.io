import {TimelineSlider} from './TimelineSlider';
import {REGIONAL_PAST_YEARS,REGIONAL_FUTURE_YEARS} from '../types/regional-timeline';
export function RegionalYearSlider({period,year,onChange,availableYears,date}:{period:'past'|'future';year:number;onChange:(year:number)=>void;availableYears?:number[];date?:string}){
 const years=period==='past'?REGIONAL_PAST_YEARS:REGIONAL_FUTURE_YEARS;
 const enabled=availableYears??years;
 const choose=(target:number)=>{if(!enabled.length)return;onChange(enabled.reduce((best,y)=>Math.abs(y-target)<Math.abs(best-target)?y:best,enabled[0]));};
 return <div className="official-timeline">
  <p className="official-date"><time dateTime={`${date??`${year}-10`}-01`}>{year}年{date?.endsWith('-12')?12:10}月1日現在</time></p>
  <TimelineSlider min={years[0]} max={years.at(-1)} step={10} value={year} aria-label="地域統計の年を選択" aria-valuetext={`${year}年`} disabled={!enabled.length} onChange={e=>choose(Number(e.currentTarget.value))} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const i=enabled.indexOf(year);const next=e.key==='Home'?enabled[0]:e.key==='End'?enabled.at(-1):enabled[i+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)];if(next!==undefined)onChange(next);}}/>
  <div className="timeline-labels">{years.map(y=><button type="button" key={y} aria-pressed={year===y} disabled={!enabled.includes(y)} title={!enabled.includes(y)?'この区分のデータなし':undefined} onClick={()=>onChange(y)}>{y}</button>)}</div>
 </div>;
}
