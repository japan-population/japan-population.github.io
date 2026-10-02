import {fetchHistoricalNationalities} from './historical-nationalities';
import {arrayOf} from './estat';
import {fetchTable,dimension,codeFor,parameter,labelFor,clean,type Table} from './table';
import {CENSUS_YEARS,officialArchiveSchema,type CensusSnapshot,type OfficialArchive,type Source,type PopulationGroup,type Breakdown,type AnnualOfficial} from '../../src/types/statistics';

export const CENSUS_TABLES = [
  {id:'0003410380'},
  {id:'0000032875',year:2000,marker:'日本人',groups:{'総数(外国,不詳を含む)':'total','日本人':'japanese'}},
  {id:'0003038640',year:2010,marker:'（別掲）日本人',groups:{'(別掲)総人口':'total','(別掲)日本人':'japanese','総数(外国人の国籍)':'foreign'}},
  {id:'0003445217',year:2020,marker:'外国人',groups:{'総数':'total','日本人':'japanese','外国人':'foreign'}},
] as const;
export type ArchiveCell={year:number;group:PopulationGroup;sex:'男女計'|'男'|'女';age:string;value:number};
export function normalizeCensusCells(cells:ArchiveCell[],source:Omit<Source,'sourcePeriod'>):CensusSnapshot[]{
  const snapshots:CensusSnapshot[]=[];
  for(const year of [...new Set(cells.map(c=>c.year))].sort()){
    const groups:CensusSnapshot['groups']={};
    for(const group of ['total','japanese','foreign'] as const){
      const selected=cells.filter(c=>c.year===year&&c.group===group);
      if(!selected.length)continue;
      if(new Set(selected.map(c=>`${c.sex}/${c.age}`)).size!==selected.length)throw new Error('国勢調査の値が重複しています');
      const totals=(sex:string)=>{const row=selected.find(r=>r.sex===sex&&r.age==='総数');if(!row)throw new Error('国勢調査の人口総数が欠けています');return row.value;};
      const rows:Breakdown['rows']=[];
      for(const sex of ['男女計','男','女'] as const){
        const bySex=selected.filter(c=>c.sex===sex);
        const top85=bySex.some(r=>r.age==='85歳以上');
        for(const row of bySex){
          const start=parseInt(row.age);
          if(top85&&start>=85&&row.age!=='85歳以上')continue;
          if(row.age!=='総数'&&!/^(\d+～\d+歳|\d+歳以上)$/.test(row.age))continue;
          const age=start>=100?'100歳以上':row.age;
          const existing=rows.find(r=>r.sex===sex&&r.age===age);
          if(existing)existing.value+=row.value;
          else rows.push({group,sex,age,value:row.value});
        }
      }
      groups[group]={population:totals('男女計'),male:totals('男'),female:totals('女'),rows,
        source:{...source,sourcePeriod:`${year}-10`,scope:'国勢調査の全国人口・原数値。各年10月1日現在。年齢不詳は総数に含み、ピラミッドには含めません。総人口には国籍不詳を含みます。各年の調査範囲・定義は出典を参照してください。'}};
    }
    snapshots.push({year,date:`${year}-10-01`,groups});
  }
  return snapshots;
}
function count(raw:string):number|undefined{
  if(['***','…','...'].includes(raw))return undefined;
  if(!/^\d+$/.test(raw))throw new Error('過去統計の値が不正・欠損です');
  const n=Number(raw);if(!Number.isSafeInteger(n))throw new Error('過去統計の値が不正です');return n;
}
export function normalizeCensusTable(table:Table,config:typeof CENSUS_TABLES[number]):CensusSnapshot[]{
  const sex=dimension(table.classes,'男')['@id'],age=dimension(table.classes,'0～4歳')['@id'];
  const nat='marker'in config?dimension(table.classes,config.marker)['@id']:undefined;
  const cells:ArchiveCell[]=[];
  for(const row of table.values){
    const year=Number(labelFor(table,'time',row).match(/^(\d{4})年$/)?.[1]);
    if(!CENSUS_YEARS.includes(year))continue;
    const value=count(row.$);if(value===undefined)continue;
    if(row['@unit']&&row['@unit']!=='人')throw new Error('国勢調査の単位が不正です');
    const rawAge=labelFor(table,age,row),a=rawAge.startsWith('総数')?'総数':rawAge.replaceAll('~','～');
    if(a!=='総数'&&!/^(\d+～\d+歳|\d+歳以上)$/.test(a))continue;
    const s=labelFor(table,sex,row),g=nat&&'groups'in config?(config.groups as Record<string,PopulationGroup>)[labelFor(table,nat,row)]:'total';
    if(!g||!['男','女'].includes(s)&&!s.startsWith('総数'))throw new Error('国勢調査の分類が不正です');
    cells.push({year,group:g,sex:s==='男'?'男':s==='女'?'女':'男女計',age:a,value});
  }
  const snapshots=normalizeCensusCells(cells,table.source);
  if ('groups' in config) {
    const snapshot=snapshots.find(s=>s.year===config.year);
    if(snapshots.length!==1||!snapshot||Object.values(config.groups).some(g=>!snapshot.groups[g]))throw new Error('国勢調査の国籍別系列が欠けています');
  }
  return snapshots;
}
export function normalizeAnnualTable(table:Table):AnnualOfficial[]{
  const dim=dimension(table.classes,'出生数')['@id'];
  const labels:Record<string,keyof AnnualOfficial['counts']>={'出生数':'birth','死亡数':'death','婚姻件数':'marriage','離婚件数':'divorce'};
  const annual=new Map<number,AnnualOfficial>();
  for(const row of table.values){
    const year=Number(labelFor(table,'time',row).match(/^(\d{4})年$/)?.[1]);
    const key=labels[labelFor(table,dim,row)],value=count(row.$);
    if(!Number.isInteger(year)||!key||value===undefined)throw new Error('年間人口動態の年・値が不正です');
    if(!annual.has(year))annual.set(year,{year,counts:{} as AnnualOfficial['counts'],source:{...table.source,publisher:'厚生労働省',sourcePeriod:`${year}-12`,scope:'人口動態統計の年次確定数（日本人）。出生・死亡は発生、婚姻・離婚は届出等に基づきます。1947～1972年は沖縄県を含みません。'}});
    const item=annual.get(year)!;if(item.counts[key]!==undefined)throw new Error('年間人口動態の値が重複しています');item.counts[key]=value;
  }
  return [...annual.values()].sort((a,b)=>a.year-b.year);
}
export async function fetchOfficialArchive(appId:string,now:number):Promise<OfficialArchive>{
  const censuses=new Map<number,CensusSnapshot>();
  for(const config of CENSUS_TABLES){
    const table=await fetchTable(config.id,appId,now,'国勢調査',classes=>{
      const filters:Record<string,string>={};
      for(const label of ['人口','全国','全域']){
        const matches=classes.filter(c=>arrayOf(c.CLASS).some(v=>clean(v['@name'])===label));
        if(matches.length===1)filters[parameter(matches[0]['@id'])]=codeFor(matches[0],label);
      }
      if('marker'in config){const c=dimension(classes,config.marker);filters[parameter(c['@id'])]=arrayOf(c.CLASS).filter(v=>clean(v['@name'])in config.groups).map(v=>v['@code']).join(',');}
      const time=classes.find(c=>c['@id']==='time')!;
      filters.cdTime=arrayOf(time.CLASS).filter(c=>CENSUS_YEARS.includes(Number(clean(c['@name']).replace('年','')))).map(c=>c['@code']).join(',');
      return filters;
    });
    for(const snapshot of normalizeCensusTable(table,config)){
      const existing=censuses.get(snapshot.year);
      if(existing&&existing.groups.total!.population!==snapshot.groups.total!.population)throw new Error('国勢調査の出典間で総人口が一致しません');
      censuses.set(snapshot.year,{...snapshot,groups:{...existing?.groups,...snapshot.groups}});
    }
  }
  const annualTable=await fetchTable('0003411561',appId,now,'人口動態統計 確定数',classes=>{
    const c=dimension(classes,'出生数');const time=classes.find(c=>c['@id']==='time')!;
    const dates=arrayOf(time.CLASS).sort((a,b)=>clean(a['@name']).localeCompare(clean(b['@name'])));
    return {[parameter(c['@id'])]:['出生数','死亡数','婚姻件数','離婚件数'].map(k=>codeFor(c,k)).join(','),cdTime:dates.filter(d=>CENSUS_YEARS.includes(Number(clean(d['@name']).replace('年','')))||d===dates.at(-1)).map(d=>d['@code']).join(',')};
  });
  return officialArchiveSchema.parse({censuses:await fetchHistoricalNationalities([...censuses.values()].sort((a,b)=>a.year-b.year),appId,now),annual:normalizeAnnualTable(annualTable)});
}
