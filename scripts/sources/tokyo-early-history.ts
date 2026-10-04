import {z} from 'zod';
import observations from '../data/tokyo-early-observations.json';
import {sourceSchema} from '../../src/types/statistics';
import {tokyoAreasSchema, TOKYO_AREAS} from '../../src/types/tokyo-areas';

const observationSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('sex'),year:z.number().int(),source:sourceSchema,reference:z.boolean(),values:z.partialRecord(z.enum(TOKYO_AREAS),z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative()]))}),
  z.object({kind:z.literal('area'),year:z.number().int(),source:sourceSchema,reference:z.boolean(),values:z.record(z.enum(TOKYO_AREAS),z.number().positive().finite())}),
]);
type Past = z.infer<typeof tokyoAreasSchema.shape.past>;

// Reviewed transcriptions only: never fetch historical material on a schedule.
// A later area observation remains dated and marked as a reference, not as an
// observed area for the census year. Never derive nationality from total counts.
export function enrichTokyoEarlyHistory(input:Past):Past {
  const past = structuredClone(input);
  for (const observation of z.array(observationSchema).parse(observations)) {
    const {year,source,reference,values} = observation;
    for (const area of TOKYO_AREAS) {
      const value = values[area];
      if (value === undefined) continue;
      const snapshot = past[year]?.[area];
      const group = snapshot?.groups.total;
      if (!group?.population) throw Error(`東京都の基準人口がありません: ${year}/${area}`);
      if (observation.kind === 'sex') {
        const pair = observation.values[area]!;
        if (pair[0]+pair[1] !== group.population.value) throw Error(`男女別人口の合計が不一致です: ${year}/${area}`);
        group.male = {value:pair[0],source,reference};
        group.female = {value:pair[1],source,reference};
      } else {
        const km2 = observation.values[area];
        snapshot.area = {value:km2,source,reference};
        snapshot.density = {
          value:group.population.value/km2,reference,
          source:{...source,table:`${source.table}・人口密度の算出`,scope:`${source.scope} 人口密度＝${year}年の公表総人口÷面積。人口出典：${group.population.source.url}`},
        };
      }
    }
  }
  return tokyoAreasSchema.shape.past.parse(past);
}
