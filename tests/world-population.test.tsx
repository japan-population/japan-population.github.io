import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import raw from '../src/data/world-population.json';
import { estimateWorldPopulation, estimateWorldEvents, worldPopulationSchema } from '../src/lib/world-population';
import { WorldSection } from '../src/components/WorldSection';
const data = worldPopulationSchema.parse(raw);
describe('world population annual interpolation', () => {
  it('matches every official anchor, including the last year', () => {
    for (const point of data.points) expect(estimateWorldPopulation(data, Date.parse(point.date))?.population).toBeCloseTo(point.population, 3);
  });
  it('uses elapsed time including leap day, independent of device timezone', () => {
    const start = data.points.find(p => p.date.startsWith('2027'))!;
    const end = data.points.find(p => p.date.startsWith('2028'))!;
    const a = Date.parse(start.date), b = Date.parse(end.date);
    expect((b-a)/86400000).toBe(366);
    expect(estimateWorldPopulation(data,(a+b)/2)?.population).toBeCloseTo((start.population+end.population)/2,3);
    expect(estimateWorldPopulation(data,Date.parse('2026-10-11T12:00:00+09:00'))).toEqual(estimateWorldPopulation(data,Date.parse('2026-10-11T03:00:00Z')));
  });
  it('does not extrapolate past the published range or accept invalid times', () => {
    for (const now of [NaN, Infinity, Date.parse(data.points[0].date)-1,Date.parse(data.points.at(-1)!.date)+1]) expect(estimateWorldPopulation(data,now)).toBeNull();
    expect(worldPopulationSchema.safeParse({...raw,points:[raw.points[1],raw.points[0]]}).success).toBe(false);
  });
  it('updates from absolute time without accumulated tick errors', () => {
    const now = Date.parse('2026-10-11T00:00:00+09:00');
    const a = estimateWorldPopulation(data,now)!;
    const b = estimateWorldPopulation(data,now+3600000)!;
    expect(b.population-a.population).toBeCloseTo(a.ratePerSecond*3600,3);
  });
  it('renders a non-interactive map and one source disclosure without live announcements', () => {
    const $ = load(renderToStaticMarkup(<WorldSection now={Date.parse('2026-10-11T00:00:00+09:00')}/>));
    expect($('h2').text()).toBe('世界を見る');
    expect($('.world-map').attr('src')).toContain('maps/world.svg');
    expect($('.world-population-number').attr('aria-live')).toBe('off');
    expect($('.source-details')).toHaveLength(1);
    expect($('.segmented button')).toHaveLength(3);
    expect($('.world-vital .stat-card')).toHaveLength(2);
    expect($('.world-vital .birth')).toHaveLength(1);
    expect($('.world-vital .death')).toHaveLength(1);
    expect($('.live-label').text()).toContain('0.5秒');
    expect($('.world-population-number').text()).toMatch(/8,\d{3},\d{3},\d{3}人/);
  });
});

it('world map uses country populations with monotonically brighter fills', () => {
  const $ = load(readFileSync('public/maps/world.svg','utf8'), {xml:true});
  const countries = $('path[data-population]').toArray().map(el => ({
    population: Number($(el).attr('data-population')),
    lightness: Number($(el).attr('fill')!.match(/,([\d.]+)%/)! [1]),
  })).sort((a,b) => a.population-b.population);
  expect(countries.length).toBeGreaterThanOrEqual(170);
  expect(Number($('path[data-country="IND"]').attr('data-population'))).toBeGreaterThan(1_000_000_000);
  expect(Number($('path[data-country="JPN"]').attr('data-population'))).toBeGreaterThan(100_000_000);
  for (let i=1;i<countries.length;i++) expect(countries[i].lightness).toBeGreaterThanOrEqual(countries[i-1].lightness);
  expect($('path[data-country="ATA"]').attr('data-population')).toBeUndefined();
  expect($('path[data-country="ATA"]').attr('fill')).toBe('#d4d8d5');
});

describe('world births and deaths', () => {
  for (const kind of ['birth','death'] as const) {
    it(`${kind}: conserves the annual total, including leap years and JST resets`, () => {
      const year = 2028;
      const annual = data.annualEvents.find(r=>r.year===year)![kind];
      const start = estimateWorldEvents(data,Date.parse('2028-01-01T00:00:00+09:00'),kind)!;
      expect(start.estimate.day).toBe(0);expect(start.estimate.month).toBe(0);expect(start.estimate.year).toBe(0);
      expect(start.year.averagePerDay*366).toBeCloseTo(annual,4);
      let total=0;
      for(let m=1;m<=12;m++) total+=estimateWorldEvents(data,Date.parse(`2028-${String(m).padStart(2,'0')}-01T00:00:00+09:00`),kind)!.model.estimatedMonthCount;
      expect(total).toBeCloseTo(annual,4);
      const end=estimateWorldEvents(data,Date.parse('2028-12-31T23:59:59.999+09:00'),kind)!;
      expect(end.estimate.year).toBeCloseTo(annual,1);
      const midnight=estimateWorldEvents(data,Date.parse('2028-02-29T15:00:00Z'),kind)!;
      expect(midnight.estimate.day).toBe(0);expect(midnight.estimate.month).toBe(0);
      expect(midnight.estimate.year).toBeGreaterThan(0);
      expect(estimateWorldEvents(data,NaN,kind)).toBeNull();
      expect(estimateWorldEvents(data,Date.parse('2101-01-01T00:00:00+09:00'),kind)).toBeNull();
    });
  }
});
