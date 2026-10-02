import type {PopulationTrend} from '../types/statistics';
const yearPosition=(date:string)=>Number(date.slice(0,4))+(Number(date.slice(5,7))-1)/12;
// Twelve slider labels sit at the centres of twelve equal columns. The final
// 2020-to-latest interval occupies one column, matching the existing slider.
export function trendX(date:string,latestDate:string):number{
  const value=yearPosition(date),last=yearPosition(latestDate),boundary=2020+9/12;
  const slot=value<=boundary?(value-(1920+9/12))/10:10+(value-boundary)/(last-boundary);
  return (slot+.5)/12*100;
}
export const trendY=(value:number,maximum:number)=>220-value/maximum*200;
export function trendPaths(points:PopulationTrend['points']){
  const latest=points.at(-1)!.date,maximum=Math.max(150_000_000,Math.ceil(Math.max(...points.map(p=>p.total))/50_000_000)*50_000_000);
  const xy=(p:typeof points[number],value:number)=>`${trendX(p.date,latest)*12},${trendY(value,maximum)}`;
  const line=points.map((p,i)=>`${i?'L':'M'}${xy(p,p.total)}`).join(' ');
  const area=`${line} L${xy(points.at(-1)!,0)} L${xy(points[0],0)} Z`;
  const known=points.filter(p=>p.japanese!==undefined);
  // Unknown breakdowns are never interpolated. Split at any missing year.
  const runs:typeof known[]=[];
  for(const p of known){const run=runs.at(-1);if(!run||Number(p.date.slice(0,4))!==Number(run.at(-1)!.date.slice(0,4))+1)runs.push([p]);else run.push(p);}
  const japanese=runs.map(run=>`${run.map((p,i)=>`${i?'L':'M'}${xy(p,p.japanese!)}`).join(' ')} L${xy(run.at(-1)!,0)} L${xy(run[0],0)} Z`);
  const foreign=runs.map(run=>`${run.map((p,i)=>`${i?'L':'M'}${xy(p,p.total)}`).join(' ')} ${[...run].reverse().map(p=>`L${xy(p,p.japanese!)}`).join(' ')} Z`);
  return {line,area,japanese,foreign,maximum};
}
