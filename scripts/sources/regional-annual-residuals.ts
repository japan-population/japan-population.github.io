import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {PREFECTURES} from '../../src/lib/prefectures';
import type {RegionalMetric} from '../../src/types/regional-timeline';

const count=z.number().int().positive();
const entrySchema=z.object({
 year:z.number().int(),startDate:z.iso.date(),endDate:z.iso.date(),basis:z.enum(['official-count','official-rate']),
 sources:z.array(z.object({url:z.url(),sha256:z.string().regex(/^[a-f0-9]{64}$/),table:z.string(),publishedAt:z.iso.date()})).min(1),
 regions:z.record(z.string(),z.object({populationStart:count,populationEnd:count,naturalChange:z.number().int().optional(),naturalRatePerThousand:z.number().finite().optional(),reportedMigration:z.number().int().optional(),adjustment:z.number().int().optional()})),
}).superRefine((v,ctx)=>{
 if(v.startDate!==`${v.year-1}-10-01`||v.endDate!==`${v.year}-10-01`)ctx.addIssue({code:'custom',message:'単年残差の比較期間が一致しません'});
 if(Object.keys(v.regions).length!==47||PREFECTURES.some(p=>!v.regions[p.code]))ctx.addIssue({code:'custom',message:'単年残差の地域が不完全です'});
 for(const row of Object.values(v.regions)){
  if(v.basis==='official-count'?(row.naturalChange===undefined||row.naturalRatePerThousand!==undefined):(row.naturalRatePerThousand===undefined||row.naturalChange!==undefined))ctx.addIssue({code:'custom',message:'自然増減の単位・計算方法が不一致です'});
  if(row.reportedMigration!==undefined&&row.populationEnd-row.populationStart!==row.naturalChange!+row.reportedMigration+(row.adjustment??0))ctx.addIssue({code:'custom',message:'公表計算表の人口収支が不一致です'});
 }
});
export const annualResidualSchema=z.object({retrievedAt:z.iso.datetime({offset:true}),entries:z.array(entrySchema)}).superRefine((v,ctx)=>{if(new Set(v.entries.map(e=>e.year)).size!==v.entries.length)ctx.addIssue({code:'custom',message:'単年残差の年が重複しています'});});
export type AnnualResidualEntry=z.infer<typeof entrySchema>;
// Fixed historical extracts retain source sheet/cell ranges and original-file hashes.
// They are separate from UI census populations, whose territorial corrections must not
// be mixed into only one endpoint of these matched official population series.
export async function readAnnualResiduals(){return annualResidualSchema.parse(JSON.parse(await readFile(new URL('../data/regional-annual-residuals.json',import.meta.url),'utf8')));}
export function annualResidualMetric(entry:AnnualResidualEntry,code:string,retrievedAt:string):RegionalMetric{
 const row=entry.regions[code];if(!row)throw Error('単年残差の地域がありません');
 const naturalChange=entry.basis==='official-count'?row.naturalChange!:row.populationStart*row.naturalRatePerThousand!/1000;
 const change=row.populationEnd-row.populationStart;
 const details=entry.basis==='official-rate'?'人口は千人単位、自然増減率は0.1‰単位の公表値。自然増減数＝前年人口×当該期間の自然増減率÷1000。丸めに起因する誤差を含む。':`自然増減は同じ表の人数を使用。公表社会増減${row.reportedMigration}人、補間補正${row.adjustment}人。本欄の残差にはこの補間補正も含まれる。`;
 return {value:Math.round(change-naturalChange),reference:true,estimateKind:'residual',calculation:{method:'single-year',startYear:entry.year-1,endYear:entry.year,startDate:entry.startDate,endDate:entry.endDate,populationStart:row.populationStart,populationEnd:row.populationEnd,annualPopulationChange:change,naturalChange,naturalBasis:entry.basis},source:{publisher:'日本人口観測所（総務省統計局の人口推計を基に算出）',statistics:'過去の移動増減の単年残差推計',table:entry.sources.map(s=>s.table).join(' / '),sourcePeriod:`${entry.year}-09`,publishedAt:entry.sources[0].publishedAt,retrievedAt,url:entry.sources[0].url,status:'reference',scope:`総人口。同一系列の${entry.startDate}人口${row.populationStart}人から${entry.endDate}人口${row.populationEnd}人への増減${change}人－同期間の自然増減${naturalChange}人。前年10月～当年9月の1年間で、暦年（1～12月）とは異なる。単年の残差推計であり、転入・転出の実測件数ではない。${details} 出典：${entry.sources.map(s=>s.url).join('、')}`}};
}
