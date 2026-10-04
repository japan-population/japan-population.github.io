import {expect,test} from 'vitest';
import {readFile}from'node:fs/promises';
import {allocateTokyo,projectTokyoAreas,projectTokyoTimeline}from'../scripts/models/tokyo-projections';
import {TOKYO_AREAS,tokyoAreasSchema}from'../src/types/tokyo-areas';
import {addTokyoMovement}from'../scripts/sources/tokyo-areas';
import {readDataset}from'../scripts/dataset';
const read=async()=>tokyoAreasSchema.parse(JSON.parse(await readFile('public/data/tokyo-areas.json','utf8')));
test('1920・1930年の編入前郡部は区部に含み、3地域で東京全域と一致する',async()=>{
 const d=await read();expect(d.past['1920'].wards.groups.total!.population!.value).toBe(3358186);expect(d.past['1930'].wards.groups.total!.population!.value).toBe(4986913);
 const total1920=TOKYO_AREAS.reduce((s,a)=>s+d.past['1920'][a].groups.total!.population!.value,0);expect(total1920).toBe(3699428);
 expect(TOKYO_AREAS.reduce((s,a)=>s+d.past['1930'][a].groups.total!.population!.value,0)).toBe(5408678);
});
test('最新の3地域は各国籍の男女総数・年齢階級の合計が一致する',async()=>{
 const d=await read();for(const a of TOKYO_AREAS)for(const g of Object.values(d.latest[a].groups)){
 expect(g.population!.value).toBe(g.male!.value+g.female!.value);
 for(const sex of ['男女計','男','女'])expect(g.rows.filter(r=>r.sex===sex&&r.age!=='総数').reduce((s,r)=>s+r.value,0)).toBe(g.rows.find(r=>r.sex===sex&&r.age==='総数')!.value);
 }
});
test('2030–2100年の独自配分は東京全域の男女別・年齢別人口を維持する',async()=>{
 const data=await readDataset('public/data'),d=await read();for(const year of Object.keys(d.future)){
 const p=data.regionalTimeline!.future[year]['13'],areas=projectTokyoAreas(p,d.past['2020'],d.latest);
 for(const row of p.groups.total!.rows){expect(TOKYO_AREAS.reduce((s,a)=>s+areas[a].groups.total!.rows.find(r=>r.sex===row.sex&&r.age===row.age)!.value,0)).toBe(row.value);}
 for(const a of TOKYO_AREAS){expect(areas[a].status).toBe('reference');expect(areas[a].area).toEqual(d.latest[a].area);expect(areas[a].groups.japanese).toBeUndefined();}
 }
});
test('配分の端数を保存し、不正な重みを拒否する',()=>{expect(allocateTokyo(10,[1,1,1])).toEqual([4,3,3]);expect(allocateTokyo(0,[1,2,3])).toEqual([0,0,0]);expect(()=>allocateTokyo(10,[0,0,0])).toThrow();expect(()=>allocateTokyo(10,[NaN,1,2])).toThrow();});
test('内部移動は純増減に影響せず、区部の転入出から二重計上を除く',async()=>{
 const d=await read(),source=d.latest.wards.groups.total!.migrationChange!.source;
 const enc=(s:string)=>new TextEncoder().encode(s);const codes=['13100','13200','13300','13350'];
 const domestic=(n:number)=>enc('国籍階層,国籍,地域階層,地域コード,地域,総数\n'+['外国人含む','日本人のみ'].flatMap(g=>codes.map(c=>`0,${g},1,${c},地域,${n}`)).join('\n'));
 const international=enc('国籍階層,地域階層,国籍,地域コード,地域,国外からの転入,男,女,国外への転出\n'+['外国人含む','日本人のみ'].flatMap(g=>codes.map(c=>`0,1,${g},${c},地域,30,0,0,10`)).join('\n'));
 const matrix=enc('地域階層,地域コード,地域,総数,男,女,都の区部から\n1,13100,区部,0,0,0,40');
 addTokyoMovement(d.latest,{inflow:domestic(100),outflow:domestic(80),international,matrix},source);
 expect(d.latest.wards.groups.total!.migrationChange!.value).toBe(40);
 expect(d.latest.wards.groups.total!.events!.inflow!.value).toBe(90);
 expect(d.latest.wards.groups.total!.events!.outflow!.value).toBe(50);
 expect(d.latest.tama.groups.total!.migrationChange!.value).toBe(80);
});

test('将来の移動残差は人口変化と自然増減に整合する',async()=>{
 const data=await readDataset('public/data'),d=await read();const future=projectTokyoTimeline(data.regionalTimeline!.future,d.past['2020'],d.latest);let before=d.past['2020'];
 for(const year of Object.keys(future).map(Number).sort((a,b)=>a-b)){for(const a of TOKYO_AREAS){const g=future[year][a].groups.total!,old=before[a];const delta=Math.round((g.population!.value-old.groups.total!.population!.value)/(year-old.year));expect(g.naturalChange!.value+g.migrationChange!.value).toBe(delta);if(g.events?.inflow&&g.events.outflow)expect(g.events.inflow.value-g.events.outflow.value).toBe(g.migrationChange!.value);}before=future[year];}
});
test('最新の3地域の移動増減は全域の国内・国外移動増減と一致する',async()=>{const data=await readDataset('public/data'),d=await read();for(const group of ['total','japanese','foreign']as const){const v=data.prefectures['13'].detail!.annual.migration[group];expect(TOKYO_AREAS.reduce((n,a)=>n+d.latest[a].groups[group]!.migrationChange!.value,0)).toBe(v.domesticIn-v.domesticOut+v.internationalIn-v.internationalOut);}expect(d.latest.wards.groups.total!.rows.some(r=>r.age==='100歳以上')).toBe(true);});
