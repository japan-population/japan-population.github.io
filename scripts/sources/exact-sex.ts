import { load } from 'cheerio';
import { downloadText } from './http';
import { fetchTable, clean, dimension, codeFor, parameter, labelFor, numeric, type Table } from './table';
import { arrayOf } from './estat';
import type { ExactSex } from '../../src/types/statistics';
export const SEX_LIST = 'https://www.e-stat.go.jp/stat-search/database?layout=dataset&toukei=00200524&query=%E7%94%B7%E5%A5%B3%E5%88%A5%E4%BA%BA%E5%8F%A3%E3%81%AE%E8%A8%88%E7%AE%97%E8%A1%A8&limit=100';
export function discoverExactSex(html: string): string {
  const $ = load(html); const candidates: { id: string; month: string }[] = [];
  $('article').each((_, e) => {
    const title = clean($(e).find('.stat-resource_list-detail-item-text').text());
    if (!title.includes('男女別人口の計算表') || title.includes('都道府県') || title.includes('年齢') || !title.includes('外国人人口')) return;
    const date = $(e).text().match(/調査年月\s*(\d{4})年(\d{1,2})月/);
    const href = $(e).find('a[href*="dbview?sid="]').attr('href');
    const id = href && new URL(href, 'https://www.e-stat.go.jp/').searchParams.get('sid');
    if (!date || !id || !/^\d{10}$/.test(id)) throw new Error('男女別原値の一覧形式が変わりました');
    candidates.push({ id, month: `${date[1]}-${date[2].padStart(2, '0')}` });
  });
  const latest = candidates.sort((a,b) => b.month.localeCompare(a.month))[0];
  if (!latest) throw new Error('男女別人口の原値表が見つかりません');
  return latest.id;
}
export function normalizeExactSex(table: Table): ExactSex {
  const sex = dimension(table.classes, '男女計')['@id'];
  const group = dimension(table.classes, '日本人人口')['@id'];
  const groups = {} as ExactSex['groups'];
  const names = { 総人口: 'total', 日本人人口: 'japanese', 外国人人口: 'foreign' } as const;
  let month = '';
  for (const v of table.values) {
    const date = labelFor(table, 'time', v).match(/^(\d{4})年10月1日現在$/);
    if (!date || (month && month !== `${date[1]}-10`)) throw new Error('男女別原値の基準日が不正です');
    month = `${date[1]}-10`;
    const g = names[labelFor(table, group, v) as keyof typeof names];
    const s = labelFor(table, sex, v);
    const key = s === '男女計' ? 'total' : s === '男' ? 'male' : s === '女' ? 'female' : undefined;
    if (!g || !key) throw new Error('男女別原値の分類が不正です');
    const tab = table.classes.find(c => c['@id'] === 'tab')!;
    const unit = v['@unit'] ?? arrayOf(tab.CLASS).find(c => c['@code'] === v['@tab'])?.['@unit'];
    if (unit !== '人') throw new Error('男女別原値は1人単位である必要があります');
    groups[g] ??= {} as ExactSex['groups'][typeof g];
    if (groups[g][key] !== undefined) throw new Error('男女別原値が重複しています');
    groups[g][key] = numeric(v, table.classes, false);
  }
  for (const g of Object.values(names)) if (!groups[g] || !Number.isSafeInteger(groups[g].total) || groups[g].male + groups[g].female !== groups[g].total) throw new Error('男女別原値に欠損または合計の不一致があります');
  for (const k of ['total','male','female'] as const) if (groups.total[k] !== groups.japanese[k] + groups.foreign[k]) throw new Error('男女別原値の国籍合計が一致しません');
  return { groups, source: { ...table.source, sourcePeriod: month, scope: '各年10月1日現在の男女別人口。公表原値は1人単位。月次の人口・年齢階級別人口とは基準日が異なります。' } };
}
export async function fetchExactSex(appId: string, now: number): Promise<ExactSex> {
  const id = discoverExactSex(await downloadText(new URL(SEX_LIST)));
  const table = await fetchTable(id, appId, now, '人口推計', classes => {
    const filters: Record<string, string> = {};
    for (const c of classes) {
      if (c['@id'] === 'tab' || arrayOf(c.CLASS).some(v => clean(v['@name']) === '出生児数')) filters[parameter(c['@id'])] = codeFor(c, '人口');
    }
    const area = dimension(classes, '全国'); filters[parameter(area['@id'])] = codeFor(area, '全国');
    const time = classes.find(c => c['@id'] === 'time')!;
    const latest = arrayOf(time.CLASS).filter(c => /^\d{4}年10月1日現在$/.test(clean(c['@name']))).sort((a,b) => clean(a['@name']).localeCompare(clean(b['@name']))).at(-1);
    if (!latest) throw new Error('男女別原値の時点を選択できません');
    filters.cdTime = latest['@code'];
    return filters;
  });
  return normalizeExactSex(table);
}
