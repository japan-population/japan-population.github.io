import {PROJECTION_YEARS,type Projections,type ProjectionScenario} from '../types/projections';
import type {Breakdown,PopulationGroup,Source} from '../types/statistics';
export function futureYears(now:number){const year=new Date(now+9*3600000).getUTCFullYear();return PROJECTION_YEARS.filter(y=>y>=year);}
export function projectionView(data:Projections,scenario:ProjectionScenario,year:number,group:PopulationGroup){
 const record=data.scenarios[scenario],d=record.details[year],p=record.points.find(p=>p.year===year);
 if(!d||!p)throw new Error('選択年の将来推計がありません');
 const value=(total:number,japanese:number)=>group==='total'?total:group==='japanese'?japanese:total-japanese;
 const rows:Breakdown['rows']=d.total.ages.flatMap((a,i)=>(['男女計','男','女'] as const).map((sex,j)=>({group,sex,age:i===20?'100歳以上':`${i*5}～${i*5+4}歳`,value:value(a[j],d.japanese.ages[i][j])})));
 return {population:value(d.total.population,d.japanese.population),male:value(d.total.male,d.japanese.male),female:value(d.total.female,d.japanese.female),rows,total:d.total.population,birth:value(p.birth.total,p.birth.japanese),death:value(p.death.total,p.death.japanese)};
}
export function projectionSources(data:Projections,scenario:ProjectionScenario):Source[]{return data.scenarios[scenario].sources.map(s=>({...s,publisher:'国立社会保障・人口問題研究所',statistics:'日本の将来推計人口（令和5年推計）',sourcePeriod:'2020-10',publishedAt:data.publishedAt,retrievedAt:data.retrievedAt,status:'projection',scope:'2020年国勢調査を基準とした将来推計。各年10月1日の人口と暦年の出生・死亡。2071年以降は長期参考推計。公表値は千人単位・小数第3位（1人相当）。丸めによる内訳の差があり、実測精度を示すものではありません。'}));}
