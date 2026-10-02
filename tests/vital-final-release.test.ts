import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {parseFinal2025,mergeFinalRelease} from '../scripts/sources/vital-final-release';
const bytes=readFileSync('tests/fixtures/vital-final-2025.xlsx');
const now=Date.parse('2026-10-03T00:00:00+09:00');
it('2025年確定数を概数と区別し、出生内訳を総数へ照合する',async()=>{
 const release=await parseFinal2025(bytes,now);
 expect(release.annual.counts).toEqual({birth:671270,death:1589533,marriage:489158,divorce:179073});
 expect(release.annual.source).toMatchObject({status:'final',publishedAt:'2026-09-30',sourcePeriod:'2025-12'});
 for(const s of release.breakdowns.filter(v=>v.event==='birth'))expect(s.items.reduce((n,i)=>n+i.count,0)).toBe(671270);
 const cause=release.breakdowns.find(s=>s.kind==='cause')!;
 expect(cause.items.filter(i=>i.rank)).toHaveLength(10);
 expect(cause.items.find(i=>i.label==='他殺')?.count).toBe(211);
 expect(cause.items.find(i=>i.label==='交通事故')?.count).toBe(3348);
 expect(cause.items.find(i=>i.label==='自殺')?.count).toBe(18537);
});
it('API収録後に二重計上せず、欠けた年齢表を別年から補わない',async()=>{
 const r=await parseFinal2025(bytes,now),merged=mergeFinalRelease([],[],r);
 expect(mergeFinalRelease(merged.annual,merged.breakdowns,r)).toEqual(merged);
 expect(merged.breakdowns.some(s=>['husbandAge','wifeAge','deathAge'].includes(s.kind))).toBe(false);
 const conflict=structuredClone(r.annual);conflict.counts.birth++;
 expect(()=>mergeFinalRelease([conflict],[],r)).toThrow('一致しません');
});
it('対象年や表構造が変わった場合は公開前に失敗する',async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 book.getWorksheet('第１表')!.getCell('H5').value='令和6年(2024)';
 await expect(parseFinal2025(new Uint8Array(await book.xlsx.writeBuffer()),now)).rejects.toThrow('対象年');
});
