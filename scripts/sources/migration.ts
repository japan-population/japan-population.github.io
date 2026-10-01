import { arrayOf } from './estat';
import { fetchTable, dimension, codeFor, parameter, period, numeric, labelFor, type Table } from './table';
import { PREFECTURES } from '../../src/lib/prefectures';
import type { MigrationObservation, MigrationKind, Source } from '../../src/types/statistics';
const labels = {
  domesticIn: '他都道府県（他市町村）からの転入者数', domesticOut: '他都道府県（他市町村）への転出者数',
  internationalIn: '国外からの転入者数', internationalOut: '国外への転出者数',
};
export type MigrationHistory = { rows: MigrationObservation[]; domesticSource: Source; internationalSource: Source };
export function normalizeMigration(domestic: Table, international: Table): MigrationHistory {
  const rows = new Map<string, MigrationObservation>();
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const [table, keys] of [[domestic, ['domesticIn', 'domesticOut']], [international, ['internationalIn', 'internationalOut']]] as const) {
    const tabId = dimension(table.classes, labels[keys[0]])['@id'];
    const latest = table.values.map(v => period(labelFor(table, 'time', v))).sort().at(-1);
    if (!latest) throw new Error('人口移動のデータが空です');
    sources.push({ ...table.source, sourcePeriod: latest, scope: keys[0] === 'domesticIn' ? '日本人・外国人を含む都道府県間の移動。県内移動は含みません。' : '日本人・外国人を含む国外との移動。職権消除等は含みません。' });
    for (const v of table.values) {
      const kind = keys.find(k => codeFor(dimension(table.classes, labels[k]), labels[k]) === v[`@${tabId}`]) as MigrationKind | undefined;
      if (!kind) throw new Error('人口移動の項目が不明です');
      const month = period(labelFor(table, 'time', v)); const region = v['@area'].slice(0, 2);
      const key = `${month}/${region}/${kind}`;
      if (seen.has(key)) throw new Error('人口移動の値が重複しています');
      seen.add(key);
      if (!rows.has(month)) rows.set(month, { month, regions: {} });
      const r = rows.get(month)!;
      r.regions[region] ??= {} as MigrationObservation['regions'][string];
      r.regions[region][kind] = numeric(v, table.classes);
    }
  }
  if (sources[0].sourcePeriod !== sources[1].sourcePeriod) throw new Error('国内・国外移動の基準月が一致しません');
  for (const row of rows.values()) for (const code of ['00', ...PREFECTURES.map(p => p.code)]) for (const kind of Object.keys(labels)) if (!seen.has(`${row.month}/${code}/${kind}`)) throw new Error(`人口移動に欠損: ${row.month}/${code}/${kind}`);
  return { rows: [...rows.values()].sort((a, b) => a.month.localeCompare(b.month)), domesticSource: sources[0], internationalSource: sources[1] };
}
export async function fetchMigration(appId: string, now: number) {
  const tables: Table[] = [];
  for (const [id, keys, nationality] of [['0003420473', ['domesticIn', 'domesticOut'], '移動者'], ['0003423635', ['internationalIn', 'internationalOut'], '総数']] as const) {
    tables.push(await fetchTable(id, appId, now, '住民基本台帳人口移動報告', classes => {
      const filters: Record<string, string> = {};
      const tab = dimension(classes, labels[keys[0]]);
      filters[parameter(tab['@id'])] = keys.map(k => codeFor(tab, labels[k])).join(',');
      // Both nationality and sex can be labelled 総数: identify by their other categories.
      const sex = dimension(classes, '男'); filters[parameter(sex['@id'])] = codeFor(sex, '総数');
      const nat = dimension(classes, nationality === '移動者' ? '日本人移動者' : '日本人'); filters[parameter(nat['@id'])] = codeFor(nat, nationality);
      const area = classes.find(c => c['@id'] === 'area')!;
      filters.cdArea = arrayOf(area.CLASS).filter(c => /^(00|0[1-9]|[1-3]\d|4[0-7])000$/.test(c['@code'])).map(c => c['@code']).join(',');
      const time = classes.find(c => c['@id'] === 'time')!;
      filters.cdTime = arrayOf(time.CLASS).filter(c => /^\d{4}年\d{1,2}月$/.test(c['@name'].normalize('NFKC'))).sort((a, b) => period(a['@name']).localeCompare(period(b['@name']))).slice(-66).map(c => c['@code']).join(',');
      return filters;
    }));
  }
  return normalizeMigration(tables[0], tables[1]);
}
