import {eventBreakdownsSchema,type EventBreakdowns,type EventBreakdownData,type AnnualOfficial,type Source} from '../../src/types/statistics';

// Transcribed from the linked public tables, checked against their printed totals.
// Keep these fixed historical observations through every API refresh. No interpolation.
const retrievedAt='2026-10-03T02:58:15+09:00';
const ipss=(table:string):Source=>({
  publisher:'国立社会保障・人口問題研究所',statistics:'人口統計資料集（2021年版）',
  table:`6-${Number(table)} 性・年齢（5歳階級）別${table==='03'?'初婚':table==='05'?'再婚':'離婚'}数`,
  sourcePeriod:'1930-12',publishedAt:'2021',retrievedAt,status:'final',
  url:`https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2021/T06-${table}.files/sheet001.htm`,
  scope:'内閣統計局「日本帝国人口動態統計」による1930年の届出総数。初婚・再婚の年齢別件数は合算。婚姻の初婚再婚不詳は含めず、年間総数へ拡大しません。',
});
const yearbook:Source={
  publisher:'内閣統計局（一橋大学経済研究所所蔵）',statistics:'第50回（昭和6年）日本帝国統計年鑑',
  table:'表22 婚姻（内地）年齢別・大正9年、47頁',sourcePeriod:'1920-12',publishedAt:'1931-12-10',retrievedAt,status:'final',
  url:'https://d-repo.ier.hit-u.ac.jp/record/2005191/files/1931_2_02_022.pdf',
  scope:'1920年の内地の婚姻届出総数。公表年齢区分を保持（40歳以上は10歳階級、60歳以上は合計）。妻の14歳以下と15～19歳のみ19歳以下へ合算。',
};
const causes1990:Source={
  publisher:'厚生省（e-Stat）',statistics:'平成2年 人口動態統計',table:'5-13 年次別にみた死因（簡単分類）・性別死亡数及び率、159頁 E116 他殺',
  sourcePeriod:'1990-12',publishedAt:'2015-02-18',retrievedAt,status:'final',
  url:'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000027399554&fileKind=2',
  scope:'日本における日本人の死亡。簡単分類E116「他殺」の男女計。1980年1,113人、1990年744人。公表・更新日はe-Stat掲載日。',
};
const homicide1950:Source={
  publisher:'東京都健康安全研究センター',statistics:'研究年報 第66号（2015）',
  table:'池田一夫・阿保満「日本における他殺による死亡の歴史的状況」334頁・総数の年次推移',
  sourcePeriod:'1950-12',publishedAt:'2015',retrievedAt,status:'final',
  url:'https://www.tmiph.metro.tokyo.lg.jp/files/archive/issue/kenkyunenpo/nenpou66/333-339.pdf',
  scope:'人口動態統計を用いた全国日本人の集計（沖縄県を除く）。本文記載の1950年男性1,115人と女性768人を合算。警察の事件数ではありません。',
};
const ages=['19歳以下',...Array.from({length:10},(_,i)=>`${20+i*5}～${24+i*5}歳`),'70歳以上'];
const age1930={
  first:{husbandAge:[9829,142925,197496,55599,16052,7128,3687,2143,1219,602,248,166],wifeAge:[104844,257701,67369,19202,7438,3929,2345,1384,595,215,76,30]},
  remarriage:{husbandAge:[65,2411,11873,14919,12584,9692,6882,4552,2744,1642,830,580],wifeAge:[563,5960,10214,8106,5265,3803,2845,1942,1083,480,181,82]},
  divorce:{husbandAge:[345,6018,13862,10964,7176,4776,3259,2146,1298,751,355,309],wifeAge:[3341,14685,12806,8097,4744,3105,2148,1242,646,296,98,51]},
};

export function addHistoricalEventBreakdowns(input:EventBreakdowns,annual:AnnualOfficial[]):EventBreakdowns{
  const result=structuredClone(input);
  function addAge(year:number,event:'marriage'|'divorce',kind:'husbandAge'|'wifeAge',labels:string[],counts:number[],source:Source,options:Partial<EventBreakdownData>={}){
    const total=annual.find(a=>a.year===year)?.counts[event];
    if(total===undefined||result.some(s=>s.year===year&&s.event===event&&s.kind===kind&&s.group==='japanese'))return;
    if(labels.length!==counts.length||counts.some(n=>!Number.isInteger(n)||n<0))throw new Error('歴史年齢表の転記が不正です');
    const sum=counts.reduce((a,b)=>a+b,0);if(sum>total)throw new Error('歴史年齢表が年総数を超えています');
    result.push({year,event,kind,group:'japanese',total,coverage:sum===total?'complete':'partial',source,
      items:labels.map((label,i)=>({label,count:counts[i]})),...options});
  }
  const oldAges=['19歳以下','20～24歳','25～29歳','30～34歳','35～39歳','40～49歳','50～59歳','60歳以上'];
  addAge(1920,'marriage','husbandAge',oldAges,[21062,161719,187300,81508,39267,38011,12722,4618],yearbook,{ageGrouping:'published'});
  addAge(1920,'marriage','wifeAge',oldAges,[272+140001,242040,84023,35864,19684,18160,5030,1133],yearbook,{ageGrouping:'published'});
  for(const kind of ['husbandAge','wifeAge'] as const){
    // Age-unknown is explicitly included in each IPSS printed total. Do not
    // label the separate gap to all marriages as age-unknown (status is unknown).
    const marriageCounts=age1930.first[kind].map((n,i)=>n+age1930.remarriage[kind][i]);
    const classifiedTotal=kind==='husbandAge'?437094+68774:465128+40524;
    addAge(1930,'marriage',kind,[...ages,'年齢不詳'],[...marriageCounts,classifiedTotal-marriageCounts.reduce((a,b)=>a+b,0)],ipss('03'),{
      additionalSources:[ipss('05')],note:'初婚・再婚の合計。初婚再婚不詳は含みません。',
    });
    const divorceCounts=age1930.divorce[kind];
    addAge(1930,'divorce',kind,[...ages,'年齢不詳'],[...divorceCounts,51259-divorceCounts.reduce((a,b)=>a+b,0)],{...ipss('07'),scope:'内閣統計局「日本帝国人口動態統計」による1930年の離婚届出総数。年齢不詳は公表総数と年齢別合計の差。'});
  }
  for(const [year,count,source] of [[1950,1115+768,homicide1950],[1980,1113,{...causes1990,sourcePeriod:'1980-12'}],[1990,744,causes1990]] as const){
    const section=result.find(s=>s.year===year&&s.group==='japanese'&&s.kind==='cause');
    if(!section||section.items.some(i=>i.label==='他殺'))continue;
    section.items.push({label:'他殺',count,supplement:true});
    section.additionalSources=[...section.additionalSources??[],source];
  }
  return eventBreakdownsSchema.parse(result);
}
