import extract from '../data/regional-domestic-history.json';
import {PREFECTURES} from '../../src/lib/prefectures';
import type {RegionalTimeline,RegionalMetric} from '../../src/types/regional-timeline';

/** Calendar-year Japanese inter-prefectural moves. The series starts in 1954;
 * Okinawa is not covered before 1973. Missing observations never mean zero. */
export function supplementDomesticMigrationHistory(timeline:RegionalTimeline){
 for(const entry of extract.entries){
  const rows=entry.regions as Record<string,{inflow:number;outflow:number;net:number}>;
  const expected=PREFECTURES.filter(p=>entry.year>=1973||p.code!=='47');
  if(Object.keys(rows).length!==expected.length||expected.some(p=>!rows[p.code]))throw Error('過去の国内移動の地域が不完全です');
  if(Object.values(rows).reduce((sum,r)=>sum+r.net,0)!==0)throw Error('国内移動の転入超過合計が不一致です');
  for(const [code,row]of Object.entries(rows)){
   if(![row.inflow,row.outflow,row.net].every(Number.isSafeInteger)||row.inflow<0||row.outflow<0||row.inflow-row.outflow!==row.net)throw Error('過去の転入超過数が不一致です');
   const region=timeline.past[entry.year]?.[code];if(!region)continue;
   const source:RegionalMetric['source']={publisher:'総務省統計局',statistics:'住民基本台帳人口移動報告',table:'長期時系列 第3・4・5表（日本人移動者・男女計）',sourcePeriod:`${entry.year}-12`,publishedAt:extract.publishedAt,retrievedAt:extract.retrievedAt,url:extract.sources[2].url,status:'final',scope:`${entry.year}年1～12月の日本人の他都道府県間移動。転入${row.inflow}人－転出${row.outflow}人＝${row.net}人。国外移動・外国人・都道府県内移動は含まない。総人口表示でも日本人の国内移動のみを表示。1972年以前は沖縄を除く。原表：${extract.sources.map(s=>s.url).join('、')}`};
   for(const group of ['total','japanese']as const){
    const g=region.groups[group]??={rows:[]};
    // Complete observations already supplied by another source take precedence.
    if(g.migrationChange&&!g.migrationChange.estimateKind&&!g.migrationChange.migrationCoverage)continue;
    g.migrationChange={value:row.net,migrationCoverage:'domestic-japanese',source};
    g.events={...g.events,inflow:{value:row.inflow,migrationCoverage:'domestic-japanese',source},outflow:{value:row.outflow,migrationCoverage:'domestic-japanese',source}};
   }
  }
 }
}
