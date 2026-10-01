import { arrayOf } from './estat';
import { fetchTable, dimension, codeFor, parameter, period, numeric, labelFor, type Table } from './table';
import { populationModel } from '../models/population-model';
import type { Breakdown, PopulationObservation } from '../../src/types/statistics';
const groupLabels = { 総人口: 'total', 日本人人口: 'japanese', 外国人人口: 'foreign' } as const;
export function normalizeBreakdown(table: Table): Breakdown {
  const sex = dimension(table.classes, '男女計')['@id'];
  const age = dimension(table.classes, '0～4歳')['@id'];
  const group = dimension(table.classes, '日本人人口')['@id'];
  const observations: Record<string, PopulationObservation[]> = { total: [], japanese: [], foreign: [] };
  const dates = table.values.map(v => period(labelFor(table, 'time', v)));
  const latest = [...dates].sort().at(-1);
  const rows: Breakdown['rows'] = [];
  const seen = new Set<string>();
  table.values.forEach((v, i) => {
    const g = groupLabels[labelFor(table, group, v) as keyof typeof groupLabels];
    const s = labelFor(table, sex, v); const a = labelFor(table, age, v);
    if (!g || !['男女計', '男', '女'].includes(s)) throw new Error('人口内訳の分類が変わりました');
    if (a !== '総数' && !/^(\d+~\d+歳|100歳以上)$/.test(a)) return;
    const key = `${dates[i]}/${g}/${s}/${a}`;
    if (seen.has(key)) throw new Error('人口内訳が重複しています');
    seen.add(key);
    const value = numeric(v, table.classes);
    if (s === '男女計' && a === '総数') observations[g].push({ month: dates[i], value, source: { ...table.source, sourcePeriod: dates[i], scope: `${labelFor(table, group, v)}・男女計・全年齢。各月1日現在。内訳は千人単位の公表値を人に換算。` } });
    if (dates[i] === latest) rows.push({ group: g, sex: s as '男女計' | '男' | '女', age: a.replace('~', '～'), value });
  });
  // All three groups, three sexes and the total plus 21 disjoint age bands.
  if (rows.length !== 3 * 3 * 22) throw new Error('人口内訳に欠損があります');
  const groups = { total: populationModel(observations.total), japanese: populationModel(observations.japanese), foreign: populationModel(observations.foreign) };
  if (Object.values(groups).some(g => g.source.sourcePeriod !== latest)) throw new Error('人口内訳の基準月が一致しません');
  return { groups, rows, source: { ...table.source, sourcePeriod: latest!, scope: '男女・年齢5歳階級別人口。公表単位は千人。年齢不詳補完後の人口。' } };
}
export async function fetchBreakdown(appId: string, now: number) {
  const table = await fetchTable('0003443840', appId, now, '人口推計', classes => {
    const filters: Record<string, string> = {};
    for (const label of ['人口', '確定値', '全国']) { const d = dimension(classes, label); filters[parameter(d['@id'])] = codeFor(d, label); }
    const time = classes.find(c => c['@id'] === 'time')!;
    const dates = arrayOf(time.CLASS).sort((a, b) => period(a['@name']).localeCompare(period(b['@name'])));
    filters.cdTime = dates.slice(-13).map(c => c['@code']).join(',');
    return filters;
  });
  return normalizeBreakdown(table);
}
export async function fetchPrefectureBases(appId: string, now: number, group: 'total' | 'japanese' = 'total'): Promise<Record<string, PopulationObservation>> {
  const table = await fetchTable('0003448232', appId, now, '人口推計', classes => {
    const filters: Record<string, string> = {};
    for (const label of ['人口', '男女計', group === 'total' ? '総人口' : '日本人人口']) { const d = dimension(classes, label); filters[parameter(d['@id'])] = codeFor(d, label); }
    const time = classes.find(c => c['@id'] === 'time')!;
    filters.cdTime = [...arrayOf(time.CLASS)].sort((a, b) => period(a['@name']).localeCompare(period(b['@name']))).at(-1)!['@code'];
    const areas = classes.find(c => c['@id'] === 'area')!;
    filters.cdArea = arrayOf(areas.CLASS).filter(a => /^(0[1-9]|[1-3]\d|4[0-7])000$/.test(a['@code'])).map(a => a['@code']).join(',');
    return filters;
  });
  const result: Record<string, PopulationObservation> = {};
  for (const v of table.values) {
    const code = v['@area'].slice(0, 2); const month = period(labelFor(table, 'time', v));
    if (result[code]) throw new Error('都道府県人口が重複しています');
    result[code] = { month, value: numeric(v, table.classes, false), source: { ...table.source, sourcePeriod: month, scope: `各年10月1日現在の都道府県${group === 'total' ? '総人口' : '日本人人口'}・男女計。公表単位：千人。` } };
  }
  if (Object.keys(result).length !== 47) throw new Error('都道府県人口が47件ありません');
  return result;
}
