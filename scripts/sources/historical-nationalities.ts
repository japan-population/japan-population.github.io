import {load} from 'cheerio';
import {arrayOf} from './estat';
import {fetchTable,dimension,parameter,codeFor,labelFor,clean,type Table} from './table';
import {download} from './http';
import {CENSUS_YEARS,nationalitiesSchema,type CensusSnapshot,type Nationalities} from '../../src/types/statistics';
export const HISTORICAL_FOREIGN_TABLE='0003414213';
export const JAPANESE_REFERENCE_URL='https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2025/T10-05.files/sheet001.htm';
export function normalizeJapaneseReference(html:string,now:number){
  const $=load(html),result=new Map<number,NonNullable<CensusSnapshot['groups']['japanese']>>();
  if(!$.text().includes('日本人(1,000人)')||!$.text().includes('1950～70年は沖縄県を含まない'))throw new Error('日本人人口の参考資料の定義が変わりました');
  $('tr').each((_,tr)=>{
    const cells=$(tr).find('td').map((_,td)=>$(td).text().trim()).get(),year=Number(cells[0]);
    if(!CENSUS_YEARS.includes(year)||year>=2000)return;
    if(result.has(year))throw new Error('参考人口の年が重複しています');
    const counts=cells.slice(2,5).map(v=>{if(!/^\d[\d,]*$/.test(v))throw new Error('参考人口の値が不正です');return Number(v.replaceAll(',',''))*1000;});
    if(counts.length!==3)throw new Error('参考人口の列が欠けています');
    const note=`千人単位の公表値。${year<=1940?'当時の内地人の人口。':''}${year===1940?'国勢調査に基づく補正人口。':''}${year>=1950&&year<=1970?'沖縄県を含みません。総人口とは対象地域が異なります。':''}${[1950,1980,1990].includes(year)?'国籍不詳を除きます。':''}`;
    result.set(year,{population:counts[0],male:counts[1],female:counts[2],rows:[],coverage:'summary',precision:1000,referenceNote:note,
      source:{publisher:'国立社会保障・人口問題研究所',statistics:'人口統計資料集2025',table:'表10-5 性，日本人・外国人別人口',sourcePeriod:`${year}-10`,publishedAt:'2025-01-31',retrievedAt:new Date(now).toISOString(),url:JAPANESE_REFERENCE_URL,status:'final',scope:note+'各年10月1日現在。日本人人口を総人口と外国人人口の差から算出していません。男女別は個別に丸められているため合計が一致しない場合があります。'}});
  });
  if(result.size!==8)throw new Error('1920～1990年の日本人人口が欠けています');
  return result;
}
export function addHistoricalNationalities(censuses:CensusSnapshot[],table:Table,japanese:ReturnType<typeof normalizeJapaneseReference>,latest:Nationalities){
  const nat=dimension(table.classes,'韓国，朝鮮')['@id'],sex=dimension(table.classes,'男')['@id'];
  for(const snapshot of censuses){
    const year=snapshot.year;
    if(year===2020){snapshot.nationalities={...latest,populationTotal:snapshot.groups.total!.population};continue;}
    const values=new Map<string,number>();
    for(const row of table.values){
      if(labelFor(table,'time',row)!==`${year}年`)continue;
      if(row.$==='-'||row.$==='***')continue; // Unavailable, never interpret as zero.
      if(!/^\d+$/.test(row.$)||row['@unit']&&row['@unit']!=='人')throw new Error('過去外国人人口の値・単位が不正です');
      const key=`${labelFor(table,nat,row)}/${labelFor(table,sex,row)}`;
      if(values.has(key))throw new Error('過去外国人人口が重複しています');values.set(key,Number(row.$));
    }
    const value=(n:string,s='総数(男女別)')=>{const v=values.get(`${n}/${s}`);if(v===undefined)throw new Error('過去外国人人口が欠けています');return v;};
    const total=value('総数(国籍)'),male=value('総数(国籍)','男'),female=value('総数(国籍)','女');
    const source={...table.source,sourcePeriod:`${year}-10`,scope:'各年10月1日現在。1920～1940年は当時の内地の外地人と外国人を含む歴史的区分です。1990～2000年は外国人に関する特別集計。1920年のイギリスはインド・カナダ・オーストラリア籍を含みます。1950・1960年の一部国籍分類は沖縄県を含まず、年により分類範囲が異なります。国籍内訳は公表された個別国籍を掲載し、その他・内訳未詳は外国人総数との差引です。原表の「その他」は年により個別国籍と重複または内訳不足があるため、そのまま合算しません。国籍不詳を総人口との差から外国人へ割り当てていません。'};
    if(snapshot.groups.foreign&&snapshot.groups.foreign.population!==total)throw new Error('過去外国人人口の出典間で不一致です');
    snapshot.groups.foreign??={population:total,male,female,source,rows:[],coverage:'summary'};
    snapshot.groups.japanese??=japanese.get(year);
    if(!snapshot.groups.japanese)throw new Error('日本人人口が欠けています');
    const items=arrayOf(table.classes.find(c=>c['@id']===nat)!.CLASS)
      .filter(c=>!['総数(国籍)','その他'].includes(clean(c['@name']))&&values.has(`${clean(c['@name'])}/総数(男女別)`))
      .map(c=>({code:c['@code'],name:clean(c['@name']).replace(',','・'),value:value(clean(c['@name']))}));
    const remainder=total-items.reduce((sum,i)=>sum+i.value,0);
    if(remainder<0)throw new Error('外国人内訳が総数を超えています');
    items.push({code:'remainder',name:'その他・内訳未詳（差引）',value:remainder});
    snapshot.nationalities=nationalitiesSchema.parse({total,populationTotal:snapshot.groups.total!.population,source,items});
  }
  return censuses;
}
export function normalize2020Nationalities(table:Table):Nationalities{
  const nat=dimension(table.classes,'外国人')['@id'];
  const classes=arrayOf(table.classes.find(c=>c['@id']===nat)!.CLASS);
  const records=new Map<string,number>();
  for(const row of table.values){
    if(!/^\d+$/.test(row.$)||row['@unit']&&row['@unit']!=='人')throw new Error('2020年国籍内訳の値・単位が不正です');
    const code=row[`@${nat}`];if(records.has(code))throw new Error('2020年国籍内訳が重複しています');records.set(code,Number(row.$));
  }
  const items:Nationalities['items']=[];
  for(const c of classes){
    const code=c['@code'];if(!code.startsWith('1')||code==='1')continue;
    if(classes.some(other=>other['@code'].startsWith(code)&&other['@code']!==code))continue;
    const v=records.get(code);if(v===undefined)throw new Error('2020年国籍内訳が欠けています');
    const name=clean(c['@name']);const parent=classes.find(p=>p['@code']===code.slice(0,2));
    items.push({code,name:name==='その他'?`${parent?.['@name']}（その他）`:name,value:v});
  }
  return nationalitiesSchema.parse({total:records.get('1'),items,source:{...table.source,sourcePeriod:'2020-10',scope:'2020年10月1日現在。原数値。外国人の国籍内訳（無国籍・国名不詳を含む）。日本人・外国人の別「不詳」は含めません。'}});
}
export async function fetchHistoricalNationalities(censuses:CensusSnapshot[],appId:string,now:number){
  const table=await fetchTable(HISTORICAL_FOREIGN_TABLE,appId,now,'国勢調査 平成27年最終報告書',classes=>({
    cdTime:arrayOf(classes.find(c=>c['@id']==='time')!.CLASS).filter(c=>CENSUS_YEARS.includes(Number(clean(c['@name']).replace('年','')))).map(c=>c['@code']).join(',')
  }));
  const latest=await fetchTable('0003445217',appId,now,'令和2年国勢調査',classes=>{
    const sex=dimension(classes,'男'),age=dimension(classes,'0～4歳'),area=dimension(classes,'全国');
    return {[parameter(sex['@id'])]:codeFor(sex,'総数'),[parameter(age['@id'])]:codeFor(age,'総数'),[parameter(area['@id'])]:codeFor(area,'全国')};
  });
  const japanese=normalizeJapaneseReference(new TextDecoder('shift_jis').decode(await download(new URL(JAPANESE_REFERENCE_URL))),now);
  return addHistoricalNationalities(censuses,table,japanese,normalize2020Nationalities(latest));
}
