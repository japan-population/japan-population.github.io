import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVitalList } from '../scripts/sources/vital';
import { normalizeVital } from '../scripts/normalize/vital';
import { normalizePopulation, populationFilters } from '../scripts/normalize/population';
import type { ClassObject } from '../scripts/sources/estat';
import type { Source } from '../src/types/statistics';
const source: Source = { publisher: '厚生労働省', statistics: '人口動態統計 月報（概数）', table: '4-3', sourcePeriod: '2025-04', publishedAt: '2025-09-05', retrievedAt: '2026-10-01T00:00:00Z', status: 'provisional', scope: '日本における日本人', url: 'https://www.e-stat.go.jp/stat-search/file-download?fileKind=1&statInfId=000040309968' };
const april = readFileSync(new URL('./fixtures/vital-sample.csv', import.meta.url), 'utf8');
describe('actual official CSV regression fixtures', () => {
  it('全国・47県を抽出し、再掲都市や総数以外の列を除く', () => { const result = normalizeVital(april, source); expect(Object.keys(result.regions)).toHaveLength(48); expect(result.regions['00']).toEqual({ birth: 54686, death: 128369, marriage: 30287, divorce: 15436 }); expect(result.regions['01'].birth).toBe(1784); });
  it('旧形式の当月セクションだけを読み、累計を除く', () => { const csv = readFileSync(new URL('./fixtures/vital-2020-11.csv', import.meta.url), 'utf8'); const r = normalizeVital(csv, { ...source, sourcePeriod: '2020-11' }); expect(r.regions['00'].birth).toBe(66720); expect(r.regions['13'].birth).toBe(7858); expect(Object.keys(r.regions)).toHaveLength(48); });
  it('旧形式12月の単位付きセクションから月次値を読む', () => { const csv = readFileSync(new URL('./fixtures/vital-2020-12.csv', import.meta.url), 'utf8'); const r = normalizeVital(csv, { ...source, sourcePeriod: '2020-12' }); expect(r.regions['00'].birth).toBe(70110); expect(r.regions['01'].birth).toBe(2505); });
  it('12月の年計を月次に混入しない', () => { const csv = readFileSync(new URL('./fixtures/vital-dec-correct.csv', import.meta.url), 'utf8'); const r = normalizeVital(csv, { ...source, sourcePeriod: '2025-12' }); expect(r.regions['00']).toEqual({ birth: 61098, death: 147609, marriage: 45418, divorce: 16106 }); });
  it('CSVの年月違いを拒否', () => expect(() => normalizeVital(april, { ...source, sourcePeriod: '2025-03' })).toThrow('年月'));
  it('空欄・秘匿値は0にしない', () => expect(() => normalizeVital(april.replace('54686', '…'), source)).toThrow('不正値'));
  it('地域欠損を拒否', () => expect(() => normalizeVital(april.replace(/当月,,沖縄県[^\n]+\n/, ''), source)).toThrow('揃いません'));
  it('列構成の変更を検知', () => expect(() => normalizeVital(april.replaceAll('出生数', '未知の列'), source)).toThrow('列構成'));
});
const classes: ClassObject[] = [
  { '@id': 'tab', '@name': '表章項目', CLASS: { '@code': '001', '@name': '人口', '@unit': '千人' } },
  { '@id': 'cat01', '@name': '確定値', CLASS: { '@code': '01', '@name': '確定値' } },
  { '@id': 'cat02', '@name': '男女別', CLASS: [{ '@code': '000', '@name': '男女計' }, { '@code': '001', '@name': '男' }] },
  { '@id': 'cat03', '@name': '年齢', CLASS: { '@code': '01000', '@name': '総数' } },
  { '@id': 'cat04', '@name': '人口区分', CLASS: { '@code': '001', '@name': '総人口' } },
  { '@id': 'time', '@name': '時間軸', CLASS: { '@code': '2026000404', '@name': '2026年4月' } },
];
const value = { '@tab': '001', '@cat01': '01', '@cat02': '000', '@cat03': '01000', '@cat04': '001', '@time': '2026000404', '@unit': '千人', '$': '123540' };
describe('population API normalization', () => {
  it('全分類を明示して千人→人へ変換', () => { expect(populationFilters(classes).cdCat02).toBe('000'); expect(normalizePopulation([value], classes, source)[0].value).toBe(123540000); });
  it('不明な単位・男女計以外・重複を拒否', () => { expect(() => normalizePopulation([{ ...value, '@unit': '万人' }], classes, source)).toThrow('単位'); expect(() => normalizePopulation([{ ...value, '@cat02': '001' }], classes, source)).toThrow('フィルタ'); expect(() => normalizePopulation([value, value], classes, source)).toThrow('重複'); });
});

describe('official list discovery', () => {
  it.each([2021, 2025])('%s年12月の実数/件数表だけを選ぶ', year => {
    const html = readFileSync(new URL(`./fixtures/vital-list-${year}.html`, import.meta.url), 'utf8');
    const result = parseVitalList(html);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe(`${year}-12`);
    expect(result[0].table).toBe('12-3');
  });
});
