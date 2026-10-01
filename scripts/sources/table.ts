import { z } from 'zod';
import { estat, classSchema, arrayOf, type ClassObject } from './estat';
import type { Source } from '../../src/types/statistics';
export const clean = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
export const parameter = (id: string) => `cd${id[0].toUpperCase()}${id.slice(1)}`;
export function dimension(classes: ClassObject[], label: string): ClassObject {
  const matches = classes.filter(c => arrayOf(c.CLASS).some(v => clean(v['@name']) === clean(label)));
  if (matches.length !== 1) throw new Error(`分類を特定できません: ${label}`);
  return matches[0];
}
export function codeFor(cls: ClassObject, label: string): string {
  const matches = arrayOf(cls.CLASS).filter(v => clean(v['@name']) === clean(label));
  if (matches.length !== 1) throw new Error(`分類値を特定できません: ${label}`);
  return matches[0]['@code'];
}
export function period(label: string): string {
  const match = clean(label).match(/^(\d{4})年(?:(\d{1,2})月)?$/);
  if (!match) throw new Error('統計の年月形式が変わりました');
  return `${match[1]}-${(match[2] ?? '10').padStart(2, '0')}`;
}
export function numeric(row: Record<string, string>, classes: ClassObject[], allowZero = true): number {
  const tab = classes.find(c => c['@id'] === 'tab');
  const unit = row['@unit'] ?? (tab && arrayOf(tab.CLASS).find(c => c['@code'] === row['@tab'])?.['@unit']);
  const factor = unit === '千人' ? 1000 : unit === '人' ? 1 : 0;
  const raw = row.$ === '-' && allowZero ? '0' : row.$;
  if (!factor || !/^\d+(\.\d+)?$/.test(raw)) throw new Error('統計値または単位が不正です');
  const n = Number(raw) * factor;
  if (!Number.isSafeInteger(n) || n < 0 || (!allowZero && n === 0)) throw new Error('統計値が不正です');
  return n;
}
export type Table = { classes: ClassObject[]; values: Record<string, string>[]; source: Omit<Source, 'sourcePeriod'> };
export async function fetchTable(id: string, appId: string, now: number, statistics: string, select: (classes: ClassObject[]) => Record<string, string>): Promise<Table> {
  const raw = await estat('getMetaInfo', { statsDataId: id }, appId);
  const meta = z.object({ TABLE_INF: z.object({ UPDATED_DATE: z.string(), TITLE: z.union([z.string(), z.object({ $: z.string() })]) }), CLASS_INF: z.object({ CLASS_OBJ: z.union([classSchema, z.array(classSchema)]) }) }).parse(raw.METADATA_INF);
  const classes = arrayOf(meta.CLASS_INF.CLASS_OBJ);
  const filters = select(classes);
  const values: Record<string, string>[] = [];
  const seen = new Set<string>();
  let start = '1';
  for (;;) {
    if (seen.has(start)) throw new Error('APIのページが循環しています');
    seen.add(start);
    const rawPage = await estat('getStatsData', { statsDataId: id, ...filters, metaGetFlg: 'N', cntGetFlg: 'N', limit: '100000', startPosition: start }, appId);
    const page = z.object({ DATA_INF: z.object({ VALUE: z.union([z.record(z.string(), z.string()), z.array(z.record(z.string(), z.string()))]) }), RESULT_INF: z.object({ NEXT_KEY: z.union([z.string(), z.number()]).optional() }) }).parse(rawPage.STATISTICAL_DATA);
    for (const row of arrayOf(page.DATA_INF.VALUE)) {
      for (const [key, codes] of Object.entries(filters)) {
        const dim = key.slice(2); const field = `@${dim[0].toLowerCase()}${dim.slice(1)}`;
        if (!codes.split(',').includes(row[field])) throw new Error('APIが選択範囲外の値を返しました');
      }
      values.push(row);
    }
    if (!page.RESULT_INF.NEXT_KEY) break;
    start = String(page.RESULT_INF.NEXT_KEY);
  }
  return { classes, values, source: { publisher: '総務省統計局', statistics, table: `${typeof meta.TABLE_INF.TITLE === 'string' ? meta.TABLE_INF.TITLE : meta.TABLE_INF.TITLE.$} / ${id}`, publishedAt: meta.TABLE_INF.UPDATED_DATE.slice(0, 10), retrievedAt: new Date(now).toISOString(), url: `https://www.e-stat.go.jp/dbview?sid=${id}`, status: 'final', scope: statistics } };
}
export function labelFor(table: Table, dimensionId: string, row: Record<string, string>): string {
  const cls = table.classes.find(c => c['@id'] === dimensionId);
  const label = cls && arrayOf(cls.CLASS).find(c => c['@code'] === row[`@${dimensionId}`])?.['@name'];
  if (!label) throw new Error('統計分類コードが不明です');
  return clean(label);
}
