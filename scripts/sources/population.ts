import { z } from 'zod';
import { estat, classSchema, arrayOf } from './estat';
import { normalizePopulation, populationFilters } from '../normalize/population';
// e-Stat 003: 2020 census base, final monthly total/Japanese/foreign population.
export const POPULATION_TABLE_ID = '0003443840';
const infoSchema = z.object({ UPDATED_DATE: z.string(), TITLE: z.union([z.string(), z.object({ '$': z.string() }).passthrough()]) }).passthrough();
const metadataSchema = z.object({ TABLE_INF: infoSchema, CLASS_INF: z.object({ CLASS_OBJ: z.union([classSchema, z.array(classSchema)]) }) });
export async function fetchPopulation(appId: string, now: number) {
  const meta = await estat('getMetaInfo', { statsDataId: POPULATION_TABLE_ID }, appId);
  const metadata = metadataSchema.parse(meta.METADATA_INF);
  const title = typeof metadata.TABLE_INF.TITLE === 'string' ? metadata.TABLE_INF.TITLE : metadata.TABLE_INF.TITLE.$;
  if (!title.includes('月別人口') || !title.includes('総人口')) throw new Error('人口表のタイトルが変わりました');
  const classes = arrayOf(metadata.CLASS_INF.CLASS_OBJ);
  const filters = populationFilters(classes);
  const values: Record<string, string>[] = [];
  let start = '1';
  const visited = new Set<string>();
  for (;;) {
    if (visited.has(start)) throw new Error('APIのページが循環しています');
    visited.add(start);
    const page = await estat('getStatsData', { statsDataId: POPULATION_TABLE_ID, ...filters, metaGetFlg: 'N', cntGetFlg: 'N', limit: '100000', startPosition: start }, appId);
    const data = z.object({ DATA_INF: z.object({ VALUE: z.union([z.record(z.string(), z.string()), z.array(z.record(z.string(), z.string()))]) }), RESULT_INF: z.object({ NEXT_KEY: z.union([z.string(), z.number()]).optional() }).passthrough() }).parse(page.STATISTICAL_DATA);
    values.push(...arrayOf(data.DATA_INF.VALUE));
    if (!data.RESULT_INF.NEXT_KEY) break;
    start = String(data.RESULT_INF.NEXT_KEY);
  }
  return normalizePopulation(values, classes, { publisher: '総務省統計局', statistics: '人口推計', table: `確定値 003 / ${POPULATION_TABLE_ID}`, publishedAt: metadata.TABLE_INF.UPDATED_DATE.slice(0, 10), retrievedAt: new Date(now).toISOString(), url: `https://www.e-stat.go.jp/dbview?sid=${POPULATION_TABLE_ID}`, status: 'final', scope: '日本の総人口・男女計・全年齢。令和2年国勢調査を基準とする各月1日現在の確定値。' });
}
