import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {enrichTokyoEarlyHistory} from '../scripts/sources/tokyo-early-history';
import {tokyoAreasSchema,TOKYO_AREAS} from '../src/types/tokyo-areas';
import {RegionalSnapshotIndicators} from '../src/components/RegionalSnapshotDetail';

const read=async()=>tokyoAreasSchema.parse(JSON.parse(await readFile('public/data/tokyo-areas.json','utf8')));
test('全選択年の3地域で総人口の男女別が揃い、1920・1950・1960年の東京都合計とも一致する',async()=>{
  const {past}=await read();
  for(const areas of Object.values(past))for(const area of TOKYO_AREAS){
    const g=areas[area].groups.total!;
    expect(g.male!.value+g.female!.value).toBe(g.population!.value);
  }
  for(const [year,male,female]of [[1920,1952989,1746439],[1950,3169389,3108111],[1960,4997023,4686779]]){
    for(const [key,value]of [['male',male],['female',female]]as const){
      expect(TOKYO_AREAS.reduce((s,a)=>s+past[year][a].groups.total![key]!.value,0)).toBe(value);
    }
  }
  expect(past[1950].islands.groups.total!.male!.value).toBe(10350+3421+6558);
  expect(past[1950].islands.groups.total!.female!.value).toBe(10590+3488+6723);
});
test('原表から再現でき、他の年や国籍のデータを補間しない',async()=>{
  const d=await read(),before=structuredClone(d.past);
  const result=enrichTokyoEarlyHistory(d.past);
  expect(result).toEqual(before);
  expect(d.past).toEqual(before);
  for(const year of Object.keys(result))for(const area of TOKYO_AREAS){
    expect(result[year][area].groups.japanese).toEqual(before[year][area].groups.japanese);
    expect(result[year][area].groups.foreign).toEqual(before[year][area].groups.foreign);
    expect(result[year][area].groups.total?.rows).toEqual(before[year][area].groups.total?.rows);
  }
});
test('1930年は編入前の周辺郡部を区部に含め、千歳・砧を多摩から除く',async()=>{
  const d=await read(),a=d.past['1930'];
  expect(a.tama.groups.total!.male!.value).toBe(25678+49087+44181+84177-4219-4108);
  expect(a.tama.groups.total!.female!.value).toBe(26210+50045+43854+79491-3891-3856);
  expect(a.wards.area!.value).toBeCloseTo(81.219+114.682+74.789+125.508+53.509+100.541+12.136+9.823,6);
  expect(a.tama.area!.value).toBeCloseTo(7.294+575.736+321.284+287.576-12.136-9.823,6);
  for(const area of TOKYO_AREAS){const g=a[area].groups.total!;expect(g.male!.value+g.female!.value).toBe(g.population!.value);}
  expect(TOKYO_AREAS.reduce((sum,k)=>sum+a[k].groups.total!.male!.value,0)).toBe(2855323);
});
test('1940年は同じ範囲の男女別人口・面積を使い、小笠原を含む',async()=>{
  const d=await read();let population=0,area=0;
  for(const a of TOKYO_AREAS){const s=d.past['1940'][a],g=s.groups.total!;
    expect(g.male!.value+g.female!.value).toBe(g.population!.value);
    population+=g.population!.value;area+=s.area!.value;
  }
  expect(population).toBe(7354971);expect(area).toBeCloseTo(2144.80,6);
  expect(d.past['1940'].islands.area!.value).toBe(401.82);
});
test('過去の面積・密度を補い、近接年の面積は日付と参考値を維持する',async()=>{
  const d=await read();
  for(let year=1920;year<=1990;year+=10)for(const a of TOKYO_AREAS){
    const s=d.past[year][a];expect(s.area!.value).toBeGreaterThan(0);
    expect(s.density!.value).toBeCloseTo(s.groups.total!.population!.value/s.area!.value,8);
    expect(s.area!.reference).toBe([1920,1950,1960].includes(year));
  }
  for(const [year,sourceYear]of [[1920,1921],[1950,1953],[1960,1961]]){
    const s=d.past[year].wards;
    expect(s.area!.source.sourcePeriod.startsWith(String(sourceYear))).toBe(true);
    const $=load(renderToStaticMarkup(<RegionalSnapshotIndicators snapshot={s} group="total" tokyo/>));
    expect($('.regional-area small').first().text()).toBe(`${sourceYear}年 · 参考値`);
    expect($('.regional-density span small').text()).toBe('参考値');
  }
  // Ogasawara was outside the 1950/1960 census coverage.
  expect(d.past['1950'].islands.area!.value).toBe(299.26);
  expect(d.past['1960'].islands.area!.value).toBe(296.94);
  expect(d.past['1970'].islands.area!.value).toBe(403.08);
});
test('誤った基準人口で男女別数値を公開しない',async()=>{
  const d=await read();d.past['1930'].wards.groups.total!.population!.value++;
  expect(()=>enrichTokyoEarlyHistory(d.past)).toThrow('合計が不一致');
});
