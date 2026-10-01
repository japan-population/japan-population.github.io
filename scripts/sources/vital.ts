import { load } from 'cheerio';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { download, downloadText } from './http';
import { normalizeVital } from '../normalize/vital';
import { addMonths, monthKey } from '../../src/lib/time';
import type { VitalObservation } from '../../src/types/statistics';
export type VitalFile = { month: string; publishedAt: string; url: string; table: string };
export function parseVitalList(html: string): VitalFile[] {
  const $ = load(html);
  const files: VitalFile[] = [];
  $('article.stat-resource_list-item-dataset').each((_, article) => {
    const title = $(article).find('.stat-resource_list-detail-item-text').text().normalize('NFKC').replace(/\s/g, '');
    if (!title.includes('人口動態総覧') || !title.includes('都道府県') || !(title.includes('件数') || title.includes('(1)実数'))) return;
    const table = $(article).find('.stat-separator').toArray().map(e => $(e).text().trim()).find(t => /^\d{1,2}-3$/.test(t));
    if (!table) return;
    const details = $(article).find('.stat-resource_list-detail').text();
    const month = details.match(/調査年月\s*(\d{4})年(\d{1,2})月/);
    const publishedAt = details.match(/公開（更新）日\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    const href = $(article).find('a[data-file_type="CSV"]').attr('href');
    if (!month || !publishedAt) throw new Error('人口動態一覧の構造が変わりました');
    if (!href && `${month[1]}-${month[2].padStart(2, '0')}` < '2020-09') return;
    if (!href) throw new Error('人口動態CSVの提供形式が変わりました');
    files.push({ month: `${month[1]}-${month[2].padStart(2, '0')}`, publishedAt, url: new URL(href, 'https://www.e-stat.go.jp').href, table });
  });
  return files;
}
export function vitalListUrl(year: number, page = 1): URL {
  const url = new URL('https://www.e-stat.go.jp/stat-search/files');
  url.search = new URLSearchParams({ layout: 'dataset', cycle: '1', year: `${year}0`, toukei: '00450011', tstat: '000001028897', tclass1: '000001053058', tclass2: '000001053060', tclass3val: '0', query: '人口動態総覧', limit: '100', page: String(page) }).toString();
  return url;
}
export async function fetchVital(now: number): Promise<VitalObservation[]> {
  const year = Number(monthKey(now).slice(0, 4));
  const files = new Map<string, VitalFile>();
  for (let y = year - 6; y <= year; y++) {
    const html = await downloadText(vitalListUrl(y));
    const list = parseVitalList(html);
    // A full year has <= 37 overview tables; fail if pagination unexpectedly appears.
    const $ = load(html);
    if ($('a[rel="next"], .pager__item--next a').length) throw new Error('人口動態一覧が複数ページになりました');
    if (y >= 2021 && y < year - 1 && list.length !== 12) throw new Error(`${y}年の月次一覧が12か月揃いません (${list.length})`);
    for (const file of list) { if (files.has(file.month)) throw new Error(`月次表が重複: ${file.month}`); files.set(file.month, file); }
  }
  const latest = [...files.keys()].sort().at(-1);
  if (!latest) throw new Error('人口動態月報が見つかりません');
  const from = addMonths(latest, -65);
  const selected = [...files.values()].filter(f => f.month >= from).sort((a, b) => a.month.localeCompare(b.month));
  const cache = resolve('.cache/vital');
  await mkdir(cache, { recursive: true });
  const result: VitalObservation[] = [];
  for (const file of selected) {
    const key = createHash('sha256').update(`${file.url}/${file.publishedAt}`).digest('hex');
    const path = resolve(cache, `${key}.csv`);
    let csv: string;
    let retrievedAt: string;
    let fetched = false;
    try { csv = await readFile(path, 'utf8'); retrievedAt = (await stat(path)).mtime.toISOString(); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; csv = new TextDecoder('shift_jis').decode(await download(new URL(file.url))); retrievedAt = new Date().toISOString(); fetched = true; }
    const observation = normalizeVital(csv, { publisher: '厚生労働省', statistics: '人口動態統計 月報（概数）', table: `結果表 ${file.table}`, sourcePeriod: file.month, publishedAt: file.publishedAt, retrievedAt, url: file.url, status: 'provisional', scope: '日本において発生した日本人に関する人口動態事象。出生は子、死亡は死亡者、婚姻は夫、離婚は別居前の住所による。' });
    if (fetched) await writeFile(path, csv);
    result.push(observation);
    console.log(`人口動態: ${file.month} 全国・47都道府県を検証`);
  }
  return result;
}
