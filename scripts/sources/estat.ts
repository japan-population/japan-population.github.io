import { z } from 'zod';
import { downloadText } from './http';
const envelope = z.object({ RESULT: z.object({ STATUS: z.coerce.number() }) }).passthrough();
export async function estat(endpoint: 'getMetaInfo' | 'getStatsData', params: Record<string, string>, appId: string): Promise<Record<string, unknown>> {
  const url = new URL(`https://api.e-stat.go.jp/rest/3.0/app/json/${endpoint}`);
  url.search = new URLSearchParams({ ...params, appId, lang: 'J' }).toString();
  // Never log a URL, response body, server error, or nested fetch exception: each may contain appId.
  try {
    const json = JSON.parse(await downloadText(url)) as Record<string, unknown>;
    const body = envelope.parse(json[endpoint === 'getMetaInfo' ? 'GET_META_INFO' : 'GET_STATS_DATA']);
    if (body.RESULT.STATUS !== 0) throw new Error('API error');
    return body;
  } catch { throw new Error(`e-Stat ${endpoint} が失敗しました。ID・利用制限・表構成を確認してください。`); }
}
export const classSchema = z.object({ '@id': z.string(), '@name': z.string(), CLASS: z.union([z.array(z.object({ '@code': z.string(), '@name': z.string(), '@unit': z.string().optional() }).passthrough()), z.object({ '@code': z.string(), '@name': z.string(), '@unit': z.string().optional() }).passthrough()]) });
export type ClassObject = z.infer<typeof classSchema>;
export const arrayOf = <T>(value: T | T[]): T[] => Array.isArray(value) ? value : [value];
