import {supplementDomesticMigrationHistory} from '../sources/regional-domestic-history';
import {readAnnualResiduals,annualResidualMetric} from '../sources/regional-annual-residuals';
import ExcelJS from 'exceljs';
import type {OfficialArchive,Source} from '../../src/types/statistics';
import type {RegionalTimeline} from '../../src/types/regional-timeline';
import {PREFECTURES} from '../../src/lib/prefectures';
import {REGIONAL_HISTORY_URL} from '../sources/regional-timeline';

function interpolate(points:{year:number;value:number}[],year:number):number|undefined{
 const exact=points.find(p=>p.year===year);if(exact)return exact.value;
 const lower=points.filter(p=>p.year<year).sort((a,b)=>b.year-a.year)[0],upper=points.filter(p=>p.year>year).sort((a,b)=>a.year-b.year)[0];
 return lower&&upper?lower.value+(upper.value-lower.value)*(year-lower.year)/(upper.year-lower.year):undefined;
}

/** Annualized residual, not observed moves or a decomposition into arrivals/departures. */
export async function estimateHistoricalMigration(timeline:RegionalTimeline,history:Uint8Array,archive:OfficialArchive,now:number){
 supplementDomesticMigrationHistory(timeline);
 const annual=await readAnnualResiduals();
 const book=new ExcelJS.Workbook();await book.xlsx.load(history as never);const sheet=book.worksheets[0];
 const baselines:Record<string,Record<number,number>>={};
 for(const p of PREFECTURES){
  const points:Record<number,number>={};
  sheet.eachRow(row=>{if(row.getCell(1).text!==`${p.code}000_${p.name}`||row.getCell(2).text!=='総数')return;
   for(let year=1920;year<=2020;year+=5){if(year===1945)continue;const col=3+(year-1920)/5*7;
    if(sheet.getCell(11,col).text!==`${year}年`)throw Error('人口残差推計の国勢調査年列が不正です');
    const v=row.getCell(col).value;if(typeof v==='number'&&v>0)points[year]=v;
   }
  });
  // Override the unharmonized 1950 Ryukyu/Kagoshima counts before taking any differences.
  for(const [year,records]of Object.entries(timeline.past))points[Number(year)]=records[p.code].groups.total!.population!.value;
  baselines[p.code]=points;
 }
 for(let year=1920;year<=2010;year+=10){
  const national=archive.annual.find(r=>r.year===year);if(!national)throw Error('残差推計の全国人口動態がありません');
  for(const p of PREFECTURES){
   // Observed single-year migration supplied by a source always takes precedence.
   // Only missing years receive a clearly labelled annualized residual fallback.
   const g=timeline.past[year][p.code].groups.total!;if(g.migrationChange&&!g.migrationChange.estimateKind)continue;
   const single=annual.entries.find(e=>e.year===year);
   if(single){g.migrationChange=annualResidualMetric(single,p.code,annual.retrievedAt);continue;}
   if(g.migrationChange)continue;
   // 1920 has no earlier census. 1950 uses the postwar 1950–55 interval to avoid
   // treating the differently covered 1945 survey as a comparable population baseline.
   const startYear=year===1920||year===1950?year:year-5,endYear=startYear===year?year+5:year;
   const populationStart=baselines[p.code][startYear],populationEnd=baselines[p.code][endYear];
   if(!populationStart||!populationEnd)throw Error('残差推計の比較人口が欠けています');
   const annualPopulationChange=(populationEnd-populationStart)/(endYear-startYear);
   let usedNationalRate=false;
   const naturalAt=(at:number)=>{
    // Interpolate only between observed regional years; never extrapolate 1950 rates into 1920.
    const local=Object.entries(timeline.past).flatMap(([y,rs])=>{const events=rs[p.code].groups.total?.events;
     // 1950 Kagoshima vital statistics exclude Amami; do not mix that territory with corrected population.
     return events?.birth&&events.death&&!(p.code==='46'&&Number(y)===1950)?[{year:Number(y),value:events.birth.value-events.death.value}]:[];
    });
    const regional=interpolate(local,at);if(regional!==undefined)return regional;
    usedNationalRate=true;
    const nationalNatural=interpolate(archive.annual.map(a=>({year:a.year,value:a.counts.birth-a.counts.death})),at);
    const regionalPopulation=(code:string)=>interpolate(Object.entries(baselines[code]).map(([y,value])=>({year:Number(y),value})),at);
    const denominator=PREFECTURES.filter(p=>!(at>=1947&&at<=1972&&p.code==='47')).reduce((s,p)=>s+(regionalPopulation(p.code)??NaN),0);
    if(nationalNatural===undefined||!Number.isFinite(denominator)||denominator<=0)throw Error('自然増減率の参考配分が不正です');
    return nationalNatural/denominator*regionalPopulation(p.code)!;
   };
   // Integrate the interpolated annual natural-change rate over the SAME census interval.
   // This avoids subtracting one year's natural change from a different period's population growth.
   let naturalTotal=0;for(let at=startYear;at<endYear;at++)naturalTotal+=(naturalAt(at)+naturalAt(at+1))/2;
   const naturalChange=naturalTotal/(endYear-startYear),naturalBasis=usedNationalRate?'national-rate':'regional-japanese';
   const source:Source={publisher:'日本人口観測所',statistics:'過去の移動増減の参考推計',table:'国勢調査間の年平均人口増減－同期間の年平均自然増減',sourcePeriod:`${year}-12`,publishedAt:g.population!.source.publishedAt,retrievedAt:new Date(now).toISOString(),url:REGIONAL_HISTORY_URL,status:'reference',scope:`移動の実測値ではない残差推計（年換算）。${startYear}年人口${populationStart}人→${endYear}年人口${populationEnd}人の年平均増減${annualPopulationChange}人から、同じ${startYear}～${endYear}年区間の自然増減の年平均${naturalChange.toFixed(3)}人を差し引く。${usedNationalRate?'当県の出生・死亡の年次が不足する箇所は、全国自然増減率を当県の総人口に適用した参考値。地域差を捉えない。':'当県の日本人の出生－死亡を総人口の近似として使用。外国人の自然増減との差は誤差となる。'}自然増減は収録年の間を線形補間して区間積分し年平均にする。全国率の分母は1947～1972年は沖縄を除いた同年の都道府県人口合計。自然増減資料：${[g.events?.birth?.source.url,usedNationalRate?national.source.url:undefined].filter(Boolean).join("、")}。人口増減と自然増減の比較期間は同一だが、自然増減には補間・近似を含む。選択年単年の移動実績を復元するものではない。調査誤差・国籍や境界の変更・未把握の出生死亡等も残差に含む。1920・1950年は後続5年間を使用。1950年は奄美を鹿児島へ組替え済みだが、基準日の違いと未収録島しょ部の影響は残る。公表日は基礎人口表の公表・更新日。`};
   g.migrationChange={value:Math.round(annualPopulationChange-naturalChange),source,reference:true,estimateKind:'residual',calculation:{method:'multi-year',startYear,endYear,populationStart,populationEnd,annualPopulationChange,naturalChange,naturalBasis}};
  }
 }
}
