import ExcelJS from 'exceljs';
import { load } from 'cheerio';
import { download, downloadText } from './http';
import { addMonths } from '../../src/lib/time';
import { populationGroups, type PopulationObservation, type Source } from '../../src/types/statistics';
export const EXACT_LIST = 'https://www.e-stat.go.jp/stat-search/files?layout=dataset&toukei=00200524&tstat=000000090001&tclass1=000001011678&query=%E5%85%A8%E5%9B%BD%E4%BA%BA%E5%8F%A3%E3%81%AE%E6%8E%A8%E7%A7%BB&limit=100';
export type ExactHistory = Record<typeof populationGroups[number], PopulationObservation[]>;
export function discoverExactPopulation(html: string): { url: string; publishedAt: string } {
  const $ = load(html);
  const files: { url: string; publishedAt: string }[] = [];
  $('article.stat-resource_list-item-dataset').each((_, e) => {
    const text = $(e).text().normalize('NFKC').replace(/\s+/g, ' ');
    if (!text.includes('(参考表)全国人口の推移')) return;
    const link = $(e).find('a[data-file_type^="EXCEL"]').attr('href');
    const publishedAt = text.match(/公開[（(]更新[）)]日\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!link || !publishedAt) throw new Error('人口参考表のダウンロード情報が変わりました');
    files.push({ url: new URL(link, 'https://www.e-stat.go.jp').href, publishedAt });
  });
  const latest = files.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  if (!latest) throw new Error('全国人口の参考表が見つかりません');
  return latest;
}
export async function normalizeExactPopulation(bytes: Uint8Array, source: Omit<Source, 'sourcePeriod'>): Promise<ExactHistory> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet = book.worksheets[0];
  if (!sheet || !sheet.getCell('A1').text.includes('全国人口の推移')) throw new Error('人口参考表のタイトルが変わりました');
  for (const [cell, label] of [['F4','総人口'], ['T4','日本人人口'], ['AH4','外国人人口'], ['C6','月初人口'], ['Q6','月初人口'], ['AE6','月初人口']]) if (!sheet.getCell(cell).text.replace(/\s/g, '').includes(label)) throw new Error('人口参考表の列構成が変わりました');
  const result: ExactHistory = { total: [], japanese: [], foreign: [] };
  let year = '';
  sheet.eachRow(row => {
    const label = row.getCell('A').text.normalize('NFKC').replace(/\s/g, '');
    const y = label.match(/^(\d{4})年$/);
    if (y) { year = y[1]; return; }
    const m = label.match(/^(\d{1,2})月$/);
    if (!m) return;
    if (!year || Number(m[1]) < 1 || Number(m[1]) > 12) throw new Error('人口参考表の月が不正です');
    const month = `${year}-${m[1].padStart(2, '0')}`;
    for (const [i, group] of populationGroups.entries()) {
      const value = row.getCell(['D','R','AF'][i]).value;
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('人口参考表に欠損または非整数があります');
      result[group].push({ month, value, source: { ...source, sourcePeriod: month } });
    }
  });
  for (const group of populationGroups) {
    const rows = result[group];
    if (rows.length < 13) throw new Error('人口参考表の13か月が揃っていません');
    rows.forEach((row, i) => { if (i && row.month !== addMonths(rows[i - 1].month, 1)) throw new Error('人口参考表の月が連続していません'); });
  }
  result.total.forEach((r,i) => { if (r.value !== result.japanese[i].value + result.foreign[i].value) throw new Error('人口参考表の国籍別合計が一致しません'); });
  return result;
}
export async function fetchExactPopulation(now: number): Promise<ExactHistory> {
  const file = discoverExactPopulation(await downloadText(new URL(EXACT_LIST)));
  return normalizeExactPopulation(await download(new URL(file.url)), { publisher: '総務省統計局', statistics: '人口推計', table: '参考表 全国人口の推移', publishedAt: file.publishedAt, retrievedAt: new Date(now).toISOString(), url: file.url, status: 'final', scope: '総人口・日本人人口・外国人人口の月初人口（確定値）。公表された1人単位の値。国勢調査を基準とする公式推計であり、実測値ではありません。' });
}
