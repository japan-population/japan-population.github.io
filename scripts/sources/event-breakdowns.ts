import {arrayOf,type ClassObject} from './estat';
import {fetchTable,clean,parameter,labelFor,type Table} from './table';
import {eventBreakdownsSchema,type EventBreakdowns,type EventBreakdownData,type AnnualOfficial} from '../../src/types/statistics';

export const EVENT_BREAKDOWN_TABLES=['0003411599','0003411603','0003411659','0003411657','0003411661','0003411951','0003411959','0003411840','0003411865','0003411655','0003411656'] as const;
// Keep annual event totals untouched. These tables only describe their composition.
export function breakdownFilters(id:string,classes:ClassObject[]):Record<string,string>{
  const filters:Record<string,string>={};
  for(const cls of classes){
    const name=clean(cls['@name']),all=arrayOf(cls.CLASS);let selected=all;
    if(name==='表章項目'&&id!=='0003411656'&&all.some(v=>/数$/.test(v['@name'])))selected=all.filter(v=>/数$/.test(v['@name']));
    if(['性別','初婚・再婚','届出月','月'].includes(name)&&all.some(v=>v['@name']==='総数'))selected=all.filter(v=>v['@name']==='総数');
    if(id==='0003411659'&&name.includes('死因'))selected=all.filter(v=>v['@name']==='総数');
    if(id==='0003411661'&&name.includes('年齢'))selected=all.filter(v=>v['@name']==='総数');
    if(id==='0003411599'&&name.includes('年齢'))selected=all.filter(v=>v['@name'].startsWith('出生数_'));
    if(!selected.length)throw new Error('人口動態内訳の分類が見つかりません');
    if(selected.length!==all.length)filters[parameter(cls['@id'])]=selected.map(v=>v['@code']).join(',');
  }
  return filters;
}
type Row={year:number;n:number;labels:Record<string,string>};
function rows(table:Table):Row[]{
  return table.values.flatMap(v=>{
    const raw=clean(v.$).replaceAll(',','');
    if(['・','…','...','***',''].includes(raw))return [];
    if(raw!=='-'&&!/^\d+(\.\d+)?$/.test(raw))throw new Error('人口動態内訳に不明な欠測記号があります');
    const labels=Object.fromEntries(table.classes.map(c=>[clean(c['@name']),labelFor(table,c['@id'],v)]));
    const time=Object.entries(labels).find(([k])=>k.includes('時間軸'))?.[1];
    if(!time||!/^\d{4}年$/.test(time))throw new Error('人口動態内訳の年が不明です');
    return [{year:Number(time.slice(0,4)),n:raw==='-'?0:Number(raw),labels}];
  });
}
const value=(r:Row,part:string)=>Object.entries(r.labels).find(([k])=>k.includes(part))?.[1]??'';
const causeName=(s:string)=>clean(s).replace(/^(?:Hi\d+|\d{5})_/,'').replace(/^\(再掲\)/,'');
export function fiveYearAge(label:string):string|null{
  const s=clean(label).replace(/^出生数_/,'').split('・').at(-1)!.replaceAll('~','～');
  if(s==='不詳')return s;
  if(/歳以上$|歳以下$|～\d+歳$/.test(s))return s;
  const match=s.match(/^(\d+)歳$/);if(!match)return null;
  const n=Number(match[1]);if(n<20)return '19歳以下';if(n>=80)return '80歳以上';
  const start=Math.floor(n/5)*5;return `${start}～${start+4}歳`;
}
export function normalizeEventBreakdowns(tables:Record<string,Table>,annual:AnnualOfficial[]):EventBreakdowns{
  const parsed=Object.fromEntries(Object.entries(tables).map(([id,t])=>[id,rows(t)]));
  const result:EventBreakdowns=[];
  const totals=new Map(annual.map(a=>[a.year,a.counts]));
  function section(id:string,event:EventBreakdownData['event'],kind:EventBreakdownData['kind'],year:number,total:number,items:EventBreakdownData['items'],note?:string,partial=false){
    if(!items.length)return;
    const key=result.findIndex(s=>s.event===event&&s.kind===kind&&s.year===year);if(key!==-1)return;
    const sum=items.reduce((n,i)=>n+i.count,0);
    if(kind!=='cause'&&sum>total)throw new Error('年齢内訳が年総数を超えています');
    result.push({event,kind,year,group:'japanese',total,items,coverage:partial||sum!==total?'partial':'complete',note,source:{...tables[id].source,publisher:'厚生労働省',sourcePeriod:`${year}-12`,scope:`日本における日本人の人口動態${year>=1947&&year<=1972?'（沖縄県を除く）':''}`}});
  }
  function ageTable(id:string,event:EventBreakdownData['event'],historical=false){
    const data=parsed[id];
    for(const year of new Set(data.map(r=>r.year))){
      for(const person of event==='marriage'||event==='divorce'?['夫','妻']:['']){
        const selected=data.filter(r=>r.year===year&&(!person||value(r,'夫・妻')===person)&&(!value(r,'月')||value(r,'月')==='総数')&&(!value(r,'表章')||/数$/.test(value(r,'表章')))&&(!value(r,'死因')||causeName(value(r,'死因'))==='総数'));
        const totalRows=selected.filter(r=>value(r,'年齢').replace(/^出生数_/,'')==='総数');
        if(!totalRows.length)continue;
        const tableTotal=totalRows.reduce((s,r)=>s+r.n,0),total=totals.get(year)?.[event]??tableTotal;
        const counts=new Map<string,number>();
        for(const r of selected){const age=fiveYearAge(value(r,'年齢'));if(age)counts.set(age,(counts.get(age)??0)+r.n);}
        const items=[...counts].map(([label,count])=>({label,count})).sort((a,b)=>(a.label==='不詳'?999:parseInt(a.label))-(b.label==='不詳'?999:parseInt(b.label)));
        if(items.reduce((s,i)=>s+i.count,0)!==tableTotal)throw new Error(`年齢区分の欠損: ${id}/${year}/${person}`);
        const kind=person==='夫'?'husbandAge':person==='妻'?'wifeAge':event==='birth'?'motherAge':'deathAge';
        const note=historical?(event==='marriage'?'当年に結婚生活に入り届け出た婚姻のみ。同居開始時の年齢。':'当年に別居し届け出た離婚のみ。別居時の年齢。'):person?'届出時の年齢。':undefined;
        section(id,event,kind,year,total,items,note,historical);
      }
    }
  }
  ageTable('0003411599','birth');ageTable('0003411659','death');
  ageTable('0003411951','marriage');ageTable('0003411959','divorce');
  ageTable('0003411840','marriage',true);ageTable('0003411865','divorce',true);
  for(const year of new Set(parsed['0003411603'].map(r=>r.year))){
    const data=parsed['0003411603'].filter(r=>r.year===year&&value(r,'表章')==='出生数');
    const total=data.find(r=>value(r,'出生順位')==='総数')?.n;if(total===undefined)continue;
    section('0003411603','birth','birthOrder',year,total,data.filter(r=>value(r,'出生順位')!=='総数').map(r=>({label:value(r,'出生順位'),count:r.n})), '出生順位は、その母の生まれてきた子の順番（死産を含まない）。');
  }
  const causeCounts=new Map<number,Map<string,number>>(),deathTotals=new Map<number,number>(),deathRates=new Map<number,number>();
  for(const id of ['0003411656','0003411657'])for(const r of parsed[id]){
    const name=causeName(value(r,'死因'));if(value(r,'性別')!=='総数')continue;
    if(value(r,'表章')==='死亡率'){if(name==='総数')deathRates.set(r.year,r.n);continue;}
    if(name==='総数')deathTotals.set(r.year,r.n);
    if(!causeCounts.has(r.year))causeCounts.set(r.year,new Map());causeCounts.get(r.year)!.set(name,r.n);
  }
  const latestRanks=parsed['0003411661'];
  for(const year of new Set([...parsed['0003411655'],...latestRanks].map(r=>r.year))){
    const total=totals.get(year)?.death??deathTotals.get(year);if(!total)continue;
    const exact=latestRanks.filter(r=>r.year===year&&value(r,'表章')==='死亡数'&&r.n>0);
    const ranked=exact.length?exact:parsed['0003411655'].filter(r=>r.year===year&&r.n>0);
    const counts=causeCounts.get(year)??new Map();
    const items:EventBreakdownData['items']=[];
    for(const r of ranked){
      const name=causeName(value(r,'死因順位及び'));
      const rank=Number(r.labels['死因順位']?.replace(/\D/g,''));
      const known=exact.length?r.n:counts.get(name);
      const baseRate=deathRates.get(year);
      const count=known??(baseRate?Math.round(total*r.n/baseRate):undefined);
      if(count!==undefined)items.push({label:name,count,rank,approximate:known===undefined});
    }
    items.sort((a,b)=>(a.rank??99)-(b.rank??99));
    for(const name of ['交通事故','自殺','他殺']){const count=counts.get(name);if(count!==undefined&&!items.some(i=>i.label===name))items.push({label:name,count,supplement:true});}
    section(exact.length?'0003411661':'0003411655','death','cause',year,total,items,
      '公式の死因順位。交通事故は不慮の事故の内数。'+(items.some(i=>i.approximate)?'参考値は公表死亡率から算出。':'')+(year<1950?'この年の公式順位表は上位5項目まで。':''),true);
    const s=result.at(-1);if(s?.event==='death'&&s.year===year){
      s.additionalSources=['0003411656','0003411657'].filter(id=>parsed[id].some(r=>r.year===year)).map(id=>({...tables[id].source,sourcePeriod:`${year}-12`}));
    }
  }
  const filtered=result.filter(s=>totals.has(s.year)||s.year===Math.max(...result.map(v=>v.year)));
  for(const event of ['birth','death','marriage','divorce'])if(!filtered.some(s=>s.event===event))throw new Error('人口動態内訳が欠けています');
  return eventBreakdownsSchema.parse(filtered);
}
export async function fetchEventBreakdowns(appId:string,now:number,annual:AnnualOfficial[]):Promise<EventBreakdowns>{
  const tables:Record<string,Table>={};
  for(const id of EVENT_BREAKDOWN_TABLES)tables[id]=await fetchTable(id,appId,now,'人口動態統計 確定数',classes=>breakdownFilters(id,classes));
  return normalizeEventBreakdowns(tables,annual);
}
