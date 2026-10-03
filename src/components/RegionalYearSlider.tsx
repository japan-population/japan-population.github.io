import {TimelineSlider} from './TimelineSlider';
import {REGIONAL_PAST_YEARS,REGIONAL_FUTURE_YEARS} from '../types/regional-timeline';
export function RegionalYearSlider({period,year,onChange}:{period:'past'|'future';year:number;onChange:(year:number)=>void}){
 const years=period==='past'?REGIONAL_PAST_YEARS:REGIONAL_FUTURE_YEARS;
 return <div className="official-timeline">
  <p className="official-date"><time dateTime={`${year}-10-01`}>{year}年10月1日現在</time></p>
  <TimelineSlider min={years[0]} max={years.at(-1)} step={10} value={year} aria-label="地域統計の年を選択" aria-valuetext={`${year}年`} onChange={e=>onChange(Number(e.currentTarget.value))}/>
  <div className="timeline-labels">{years.map(y=><button type="button" key={y} aria-pressed={year===y} onClick={()=>onChange(y)}>{y}</button>)}</div>
 </div>;
}
