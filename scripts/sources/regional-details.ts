import {fetchRegionalIndicators} from './regional-indicators';
import ExcelJS from 'exceljs';
import {PREFECTURES} from '../../src/lib/prefectures';
import {populationGroups,regionalDetailSchema,type RegionalDetail,type Source} from '../../src/types/statistics';
import {CENSUS_REGIONS_URL,normalizeCensusRegions} from './census-regions';
import {download} from './http';
export const REGIONAL_VITAL_URL='https://www.mhlw.go.jp/toukei/saikin/hw/jinkou/kakutei25/xls/06_hyoR07.xlsx';
export const REGIONAL_DOMESTIC_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040407038&fileKind=0';
export const REGIONAL_INTERNATIONAL_URL='https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040407055&fileKind=0';
async function workbook(bytes:Uint8Array){const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);return book;}
function count(cell:ExcelJS.Cell){const v=cell.value;if(v==='-')return 0;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('地域実績に欠損・不正な人数があります');return v;}
export async function normalizeRegionalDetails(census:Uint8Array,vital:Uint8Array,domestic:Uint8Array,international:Uint8Array,now:number):Promise<Record<string,RegionalDetail>>{
  const official=await normalizeCensusRegions(census,now);
  const [cb,vb,db,ib]=await Promise.all([census,vital,domestic,international].map(workbook));
  const source=(statistics:string,table:string,url:string,publishedAt:string,scope:string,publisher='総務省統計局'):Source=>({publisher,statistics,table,url,publishedAt,scope,sourcePeriod:'2025-12',retrievedAt:new Date(now).toISOString(),status:'final'});
  const vitalSource=source('人口動態統計','2025年確定数 第4表',REGIONAL_VITAL_URL,'2026-09-30','日本において発生した日本人に関する人口動態。出生・死亡は住所地、婚姻は夫の住所地、離婚は別居前の住所地による。','厚生労働省');
  const domesticSource=source('住民基本台帳人口移動報告','2025年年報 第1表',REGIONAL_DOMESTIC_URL,'2026-02-03','他都道府県からの転入・他都道府県への転出。都道府県内移動を除く。');
  const internationalSource=source('住民基本台帳人口移動報告','2025年年報 国外移動 第1-1表',REGIONAL_INTERNATIONAL_URL,'2026-02-03','国外との住所移転。短期旅行・職権消除等を含めない。');
  const result=Object.fromEntries(PREFECTURES.map(p=>[p.code,{populationSource:official[p.code].total.source,rows:[],annual:{year:2025,vitalSource,domesticSource,internationalSource,japanese:undefined,migration:{}}}])) as unknown as Record<string,RegionalDetail>;
  cb.worksheets[0].eachRow(row=>{
    const match=row.getCell(1).text.match(/^(\d{2})000_/);const code=match?.[1];if(!code||!result[code])return;
    const sex=({'0_総数':'男女計','1_男':'男','2_女':'女'} as const)[row.getCell(2).text as '0_総数'];if(!sex)return;
    const age=row.getCell(3).text.replace(/^\d+_/,'');if(age!=='総数'&&age!=='年齢「不詳」'&&!/^(\d+～\d+歳|\d+歳以上)$/.test(age))return;
    // Exclude recapitulated broad age bands; retain only five-year bands and the published open-ended oldest band.
    if(age.includes('～')){const [a,b]=age.match(/\d+/g)!.map(Number);if(b-a!==4)return;}
    if(age.endsWith('歳以上')&&age!=='95歳以上')return;
    for(const [group,col] of [['total',4],['japanese',57],['foreign',5]] as const)result[code].rows.push({group,sex,age,value:count(row.getCell(col))});
  });
  const vs=vb.getWorksheet('第４表');if(!vs||!vs.getCell(2,22).text.includes('2025')||!vs.getCell(3,20).text.includes('婚姻'))throw new Error('地域人口動態の表構造が変わりました');
  vs.eachRow(row=>{const name=row.getCell(2).text.replace(/\s/g,'');const p=PREFECTURES.find(p=>p.name===name||p.name.replace(/[都府県]$/,'')===name);if(!p)return;if(result[p.code].annual.japanese)throw new Error('地域人口動態が重複しています');result[p.code].annual.japanese={birth:count(row.getCell(3)),death:count(row.getCell(6)),marriage:count(row.getCell(20)),divorce:count(row.getCell(21))};});
  for(const [book,kind,inCol,outCol] of [[db,'domestic',10,13],[ib,'international',7,10]] as const){
    const sheet=book.worksheets[0];if(!sheet.getCell(4,inCol).text.includes(kind==='domestic'?'他都道府県から':'国外から')||!sheet.getCell(4,outCol).text.includes(kind==='domestic'?'他都道府県への':'国外への')||sheet.getCell(5,inCol).text!=='総数')throw new Error('地域移動の列構造が変わりました');
    const seen=new Set<string>();
    sheet.eachRow(row=>{
      const area=row.getCell(5).text.padStart(5,'0');if(!/^\d{2}000$/.test(area))return;const code=area.slice(0,2);if(code!=='00'&&!result[code])return;
      const group=({'移動者':'total','総数':'total','日本人移動者':'japanese','日本人':'japanese','外国人移動者':'foreign','外国人':'foreign'} as const)[row.getCell(2).text as '総数'];if(!group)return;
      if(row.getCell(4).text!=='2025年')throw new Error('地域移動の年が不一致です');
      const key=`${code}/${group}`;if(seen.has(key))throw new Error('地域移動が重複しています');seen.add(key);
      if(code==='00')return;
      const m=result[code].annual.migration[group]??={} as RegionalDetail['annual']['migration']['total'];
      m[`${kind}In`]=count(row.getCell(inCol));m[`${kind}Out`]=count(row.getCell(outCol));
    });
    for(const group of populationGroups){let national:ExcelJS.Row|undefined;sheet.eachRow(r=>{if(r.getCell(5).text.padStart(5,'0')==='00000'&&r.getCell(2).text===({total:kind==='domestic'?'移動者':'総数',japanese:kind==='domestic'?'日本人移動者':'日本人',foreign:kind==='domestic'?'外国人移動者':'外国人'}[group]))national=r;});
      if(!national)throw new Error('全国移動合計がありません');
      for(const [field,col]of [[`${kind}In`,inCol],[`${kind}Out`,outCol]] as const)if(Object.values(result).reduce((sum,r)=>sum+(r.annual.migration[group]?.[field]??NaN),0)!==count(national.getCell(col)))throw new Error('地域移動と全国合計が一致しません');
    }
  }
  for(const [code,r]of Object.entries(result)){
    regionalDetailSchema.parse(r);
    for(const group of populationGroups){const rows=r.rows.filter(x=>x.group===group);if(rows.length!==66)throw new Error('地域年齢階級に欠損があります');const total=(sex:string)=>rows.find(x=>x.sex===sex&&x.age==='総数')!.value;if(total('男女計')!==official[code][group].value||total('男')+total('女')!==total('男女計'))throw new Error('地域男女別人口が一致しません');for(const sex of ['男女計','男','女'])if(rows.filter(x=>x.sex===sex&&x.age!=='総数').reduce((s,x)=>s+x.value,0)!==total(sex))throw new Error('地域年齢階級と人口が一致しません');}
  }
  return result;
}
export async function fetchRegionalDetails(now:number){const bytes=await Promise.all([CENSUS_REGIONS_URL,REGIONAL_VITAL_URL,REGIONAL_DOMESTIC_URL,REGIONAL_INTERNATIONAL_URL].map(url=>download(new URL(url))));const regions=await normalizeRegionalDetails(bytes[0],bytes[1],bytes[2],bytes[3],now);await fetchRegionalIndicators(regions,now);return regions;}
