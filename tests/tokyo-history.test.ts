import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {census1980,censusResidual} from '../scripts/sources/tokyo-history';
import {tokyoAreasSchema,TOKYO_AREAS,validateTokyoTotals} from '../src/types/tokyo-areas';
import raw1970 from '../scripts/data/tokyo-census-1970.json';
import raw1980 from '../scripts/data/tokyo-census-1980.json';
import raw1990 from '../scripts/data/tokyo-census-1990.json';
import vital from '../scripts/data/tokyo-vital-history.json';
const read=async()=>tokyoAreasSchema.parse(JSON.parse(await readFile('public/data/tokyo-areas.json','utf8')));
test('過去の地域別年齢合計と男女別総人口が一致し、確認した原表から再現できる',async()=>{
 const d=await read();validateTokyoTotals(d);
 for(const year of ['1970','1980','1990','2000']){
  const original=structuredClone(d.past[year]);const source=original.wards.groups.total!.population!.source;
  if(year==='1980')census1980(raw1980,d.past[year],source);
  if(year==='1970')censusResidual(raw1970,[...Array.from({length:18},(_,i)=>`${i*5}～${i*5+4}歳`),'90歳以上'],d.past[year],source);
  if(year==='1990')censusResidual(raw1990,[...Array.from({length:20},(_,i)=>`${i*5}～${i*5+4}歳`),'100歳以上','年齢不詳'],d.past[year],source);
  for(const a of TOKYO_AREAS){const g=d.past[year][a].groups.total!;expect(g.rows).toEqual(original[a].groups.total!.rows);
   for(const sex of ['男女計','男','女'])expect(g.rows.filter(r=>r.sex===sex&&r.age!=='総数').reduce((n,r)=>n+r.value,0)).toBe(g.rows.find(r=>r.sex===sex&&r.age==='総数')!.value);
   // 2000年は原表の公表平均年齢を使用。上で再構築する3年は階級からの参考計算。
   expect(g.averageAge!.reference).toBe(year!=='2000');
  }
 }
});
test('1960–1990年の人口動態は地域公表値を保存し、概数を確定値としない',async()=>{
 const d=await read();for(const [year,table]of Object.entries(vital))for(const a of TOKYO_AREAS){
  const g=d.past[year][a].groups.total!;
  for(const k of ['birth','death','marriage','divorce']as const){expect(g.events![k]!.value).toBe(table[a][k]);expect(g.events![k]!.source.status).toBe(+year<=1970?'provisional':'final');}
  expect(g.naturalChange!.value).toBe(table[a].birth-table[a].death);
  expect(d.past[year][a].groups.foreign?.events).toBeUndefined();
 }
});
test('2000年は国籍別の公表人口を区別し、自然増減と移動を混同しない',async()=>{
 const d=await read();for(const a of TOKYO_AREAS){const s=d.past['2000'][a];
  expect(s.groups.japanese!.rows.length).toBeGreaterThan(60);expect(s.groups.foreign!.population!.value).toBeGreaterThan(0);
  expect(s.groups.foreign!.male!.value+s.groups.foreign!.female!.value).toBe(s.groups.foreign!.population!.value);
  expect(s.groups.total!.migrationChange!.migrationCoverage).toBe('domestic-japanese');
  expect(s.groups.foreign!.migrationChange).toBeUndefined();expect(s.area!.value).toBeGreaterThan(0);
 }
});
test('地域への残差配分は負値や人口総数不一致を拒否する',async()=>{
 const d=await read(),s=d.past['1970'],source=s.wards.groups.total!.population!.source;
 const raw=structuredClone(raw1970);raw.total[0][0]=0;
 expect(()=>censusResidual(raw,[...Array.from({length:18},(_,i)=>`${i*5}～${i*5+4}歳`),'90歳以上'],s,source)).toThrow();
});
test('1970–2000年の3地域の男女別・年齢別人口は東京都全域と一致する',async()=>{
 const d=await read();
 for(const year of ['1970','1980','1990','2000']){
  const page=JSON.parse(await readFile(`public/data/regional/past-${year}.json`,'utf8'));
  const whole=page.regions['13'].groups.total;
  for(const key of ['population','male','female']as const)expect(TOKYO_AREAS.reduce((n,a)=>n+d.past[year][a].groups.total![key]!.value,0)).toBe(whole[key].value);
  for(const row of whole.rows.filter((r:{age:string})=>/^\d/.test(r.age))){
   const lower=parseInt(row.age),upper=row.age.includes('以上')?Infinity:lower+4;
   const sum=TOKYO_AREAS.reduce((n,a)=>n+d.past[year][a].groups.total!.rows.filter(r=>r.sex===row.sex&&/^\d/.test(r.age)&&parseInt(r.age)>=lower&&parseInt(r.age)<=upper).reduce((n,r)=>n+r.value,0),0);
   expect(sum,`${year} ${row.sex} ${row.age}`).toBe(row.value);
  }
 }
});
