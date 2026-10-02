import { it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { VitalSection } from '../src/components/VitalSection';
import { EventCounter } from '../src/components/EventCounter';
import { nationalSchema } from '../src/types/statistics';
import { nationalIndicators } from '../src/lib/groups';
import { defaultDistribution,eventProfiles } from '../src/lib/distribution/profiles';
import { prepareSeriesPlan,readSeriesPlan } from '../src/lib/distribution/series';
it('renders all available nationality series using the same plan values for day/month/year',()=>{
 const national=nationalSchema.parse(JSON.parse(readFileSync('public/data/national.json','utf8')));
 const month=Object.keys(national.vital.months)[0],now=Date.parse(`${month}-16T12:00:00+09:00`),year=Number(month.slice(0,4));
 for(const group of ['total','japanese','foreign'] as const){
  const html=renderToStaticMarkup(<VitalSection national={national} group={group} now={now}/>);
  expect(html).not.toMatch(/NaN|Infinity/);expect(html.match(/class="stat-card /g)).toHaveLength(6);
  const series=nationalIndicators(national,group).birth;
  if(!series)continue;
  const data=national.distribution??defaultDistribution,profile=eventProfiles(data,group).birth;
  const estimate=readSeriesPlan(prepareSeriesPlan(series,year,profile,data.calendar),now)!;
  expect(html).toContain(Math.floor(estimate.day).toLocaleString('ja-JP'));
  for(const period of ['day','month','year'] as const){
   const card=renderToStaticMarkup(<EventCounter kind="birth" estimate={estimate} model={series.months[month]} month={month} now={now} period={period} year={series.yearToDate[month]} officialLabel="公式確定値"/>);
   expect(card).toContain(Math.floor(estimate[period]!).toLocaleString('ja-JP'));
  }
 }
});
