import {z} from 'zod';
import {sourceSchema} from './statistics';
export const municipalityMapSchema=z.object({
 schemaVersion:z.literal(1),prefectureCode:z.string().regex(/^(0[1-9]|[1-3]\d|4[0-7])$/),prefectureName:z.string(),
 populationDate:z.iso.date(),areaDate:z.iso.date(),sources:z.array(sourceSchema).min(2),
 boundary:z.object({url:z.url(),credit:z.string(),license:z.url(),revision:z.string()}),
 panels:z.array(z.object({id:z.string(),label:z.string(),kilometersPerUnit:z.number().positive(),initialViewport:z.object({x:z.number(),y:z.number(),zoom:z.number().min(1).max(256)}),paths:z.array(z.object({code:z.string().regex(/^\d{5}$/),d:z.string().regex(/^[MLZ0-9., -]+$/),x:z.number().finite(),y:z.number().finite()})).min(1)})).min(1),
 municipalities:z.array(z.object({code:z.string().regex(/^\d{5}$/),name:z.string(),population:z.number().int().nonnegative(),areaKm2:z.number().finite().positive(),areaReference:z.boolean()})).min(1),
}).superRefine((v,ctx)=>{
 const codes=new Set(v.municipalities.map(m=>m.code));
 if(codes.size!==v.municipalities.length||v.municipalities.some(m=>!m.code.startsWith(v.prefectureCode)))ctx.addIssue({code:'custom',message:'市区町村コードの重複・地域不一致'});
 const paths=new Set(v.panels.flatMap(p=>p.paths.map(x=>x.code)));
 if([...paths].some(c=>!codes.has(c))||[...codes].some(c=>!paths.has(c)))ctx.addIssue({code:'custom',message:'市区町村の統計と境界が不一致'});
});
export type MunicipalityMapData=z.infer<typeof municipalityMapSchema>;
