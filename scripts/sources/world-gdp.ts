import {z} from 'zod';
const responseSchema=z.tuple([
 z.object({pages:z.literal(1),lastupdated:z.iso.date()}),
 z.array(z.object({indicator:z.object({id:z.literal('NY.GDP.MKTP.CD')}),countryiso3code:z.string(),date:z.string().regex(/^\d{4}$/),value:z.number().finite().nonnegative().nullable()})),
]);
/** Match the country to the world total for the same year, never a different year's total. */
export function worldGdpData(latest:unknown,totals:unknown){
 const countries=responseSchema.parse(latest),world=responseSchema.parse(totals);
 const denominators=new Map(world[1].filter(r=>r.countryiso3code==='WLD'&&r.value!==null&&r.value>0).map(r=>[r.date,r.value!]));
 if(!denominators.size)throw new Error('World GDP totals missing');
 const rows=new Map(countries[1].filter(r=>r.value!==null).map(r=>[r.countryiso3code,r]));
 const aliases:Record<string,string>={KOS:'XKX',PSX:'PSE',SDS:'SSD',SAH:'ESH'};
 return {
  get(code:string){
   const row=rows.get(aliases[code]??code);
   if(!row||row.value===null)return null;
   const worldUsd=denominators.get(row.date);
   if(worldUsd===undefined)throw new Error(`World GDP missing for ${row.date}`);
   return {usd:row.value,year:Number(row.date),worldUsd};
  },
  source:{publisher:'世界銀行',statistics:'World Development Indicators',table:'GDP (current US$) (NY.GDP.MKTP.CD)',sourcePeriod:String(Math.max(...[...denominators.keys()].map(Number)))+'-12',publishedAt:countries[0].lastupdated,retrievedAt:new Date().toISOString(),url:'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD',status:'final' as const,scope:'名目GDP（当年価格・米ドル）。各国の最新公表値と同じ年の世界総額（WLD）から世界比を計算。基準年は各ツールチップに表示。地域範囲は世界銀行の定義に従い、人口・地図の範囲と一致しない場合があります。欠損は他地域の値で補完しません。CC BY 4.0。'},
 };
}
