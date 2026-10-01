import { type ClassObject, arrayOf } from '../sources/estat';
import type { PopulationObservation, Source } from '../../src/types/statistics';
export function populationFilters(classes: ClassObject[]): Record<string, string> {
  const desired = new Set(['人口', '確定値', '男女計', '総数', '総人口', '全国']);
  const params: Record<string, string> = {};
  const found = new Set<string>();
  for (const cls of classes) {
    if (cls['@id'] === 'time') continue;
    const choices = arrayOf(cls.CLASS).filter(c => desired.has(c['@name'].normalize('NFKC').replace(/\s/g, '')));
    if (choices.length !== 1) throw new Error(`人口表の分類を特定できません: ${cls['@name']}`);
    found.add(choices[0]['@name'].normalize('NFKC').replace(/\s/g, ''));
    const id = cls['@id'];
    if (!/^(tab|area|cat\d{2})$/.test(id)) throw new Error('未対応の人口表分類');
    params[`cd${id[0].toUpperCase()}${id.slice(1)}`] = choices[0]['@code'];
  }
  for (const name of ['確定値', '男女計', '総数', '総人口']) if (!found.has(name)) throw new Error(`人口の必須分類がありません: ${name}`);
  return params;
}
export function normalizePopulation(values: Record<string, string>[], classes: ClassObject[], source: Omit<Source, 'sourcePeriod'>): PopulationObservation[] {
  const filters = populationFilters(classes);
  const time = classes.find(c => c['@id'] === 'time');
  if (!time) throw new Error('人口の時間軸がありません');
  const dates = new Map(arrayOf(time.CLASS).map(c => [c['@code'], c['@name']]));
  const rows = new Map<string, PopulationObservation>();
  for (const v of values) {
    for (const [key, code] of Object.entries(filters)) { const id = key.slice(2); if (v[`@${id[0].toLowerCase()}${id.slice(1)}`] !== code) throw new Error('人口APIがフィルタ外の値を返しました'); }
    const label = dates.get(v['@time'])?.normalize('NFKC');
    const date = label?.match(/^(\d{4})年(\d{1,2})月$/);
    if (!date) throw new Error('人口の年月形式が変わりました');
    const month = `${date[1]}-${date[2].padStart(2, '0')}`;
    const unit = v['@unit'] ?? arrayOf(classes.find(c => c['@id'] === 'tab')!.CLASS)[0]['@unit'];
    const factor = unit === '千人' ? 1000 : unit === '人' ? 1 : undefined;
    if (!factor || !/^\d+(\.\d+)?$/.test(v['$'])) throw new Error('人口の値または単位が不正です');
    const value = Number(v['$']) * factor;
    if (!Number.isSafeInteger(value) || value <= 0 || rows.has(month)) throw new Error('人口データの重複・不正値');
    rows.set(month, { month, value, source: { ...source, sourcePeriod: month } });
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
}
