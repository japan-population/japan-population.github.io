import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { normalizeExactPopulation, discoverExactPopulation } from '../scripts/sources/exact-population';
import { fixture } from '../scripts/build-fixture';
import { validateDataset, validateChange } from '../scripts/validation';
import { referenceModel, migrationModel } from '../scripts/models/reference-model';
import { monthStart, secondsInMonth } from '../src/lib/time';
import { eventModel } from '../scripts/models/event-model';
import { populationModel } from '../scripts/models/population-model';
const now = Date.parse('2026-10-01T12:00:00+09:00');
const source = { publisher: '総務省統計局', statistics: '人口推計', table: '参考表 全国人口の推移', publishedAt: '2026-09-24', retrievedAt: '2026-10-01T00:00:00Z', url: 'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040501637&fileKind=4', status: 'final' as const, scope: '各月1日・1人単位' };
describe('1人単位の人口参考表', () => {
  it('実際の公式Excelから月次25件を抽出し、年次行を除外', async () => {
    const history = await normalizeExactPopulation(await readFile('tests/fixtures/population-reference-2026-09.xlsx'), source);
    expect(history.total).toHaveLength(25);
    expect(history.total.at(-1)?.value).toBe(122837999);
    expect(history.total.at(-1)?.month).toBe('2026-04');
    expect(history.japanese.at(-1)?.value).toBe(118921143);
    expect(history.foreign.at(-1)?.value).toBe(3916856);
    const p = populationModel(history.total);
    expect(p.yearAgo).toBe(123396802);
    expect(p.ratePerSecond * (Date.parse(p.baseDate) - Date.parse(p.yearAgoDate)) / 1000).toBeCloseTo(-558803);
  });
  it('公式表の列が移動したら止める', async () => {
    const book = new ExcelJS.Workbook(); await book.xlsx.readFile('tests/fixtures/population-reference-2026-09.xlsx');
    book.worksheets[0].getCell('C6').value = '人口増減';
    await expect(normalizeExactPopulation(new Uint8Array(await book.xlsx.writeBuffer()), source)).rejects.toThrow('列構成');
  });
  it('参考表の欠損を0で埋めない', async () => {
    const book = new ExcelJS.Workbook(); await book.xlsx.readFile('tests/fixtures/population-reference-2026-09.xlsx');
    book.worksheets[0].getCell('AF53').value = null;
    await expect(normalizeExactPopulation(new Uint8Array(await book.xlsx.writeBuffer()), source)).rejects.toThrow('欠損');
  });
  it('実際の公開ページから最新の参考表を見つける', async () => {
    const html = await readFile('tests/fixtures/population-reference-list.html', 'utf8');
    expect(discoverExactPopulation(html)).toEqual({ url: source.url, publishedAt: source.publishedAt });
  });
});
describe('拡張統計', () => {
  it('47県・人口3区分・198の男女年齢値が完全', () => {
    const data = fixture(now); validateDataset(data);
    expect(data.national.breakdown!.rows).toHaveLength(198);
    expect(Object.values(data.prefectures).every(p => p.population && p.migration)).toBe(true);
  });
  it('ピラミッドの欠損・重複を拒否', () => {
    const data = fixture(now); data.national.breakdown!.rows[1] = data.national.breakdown!.rows[0];
    expect(() => validateDataset(data)).toThrow('欠損・重複');
  });
  it('一部の県の更新失敗・速度破損を拒否', () => {
    const a = fixture(now); delete a.prefectures['13'].migration; expect(() => validateDataset(a)).toThrow('欠け');
    const b = fixture(now); b.national.migration!.months['2026-10'].domesticIn.ratePerSecond = 0; expect(() => validateDataset(b)).toThrow('速度');
  });
  it('転入・転出の同月比較で20%以上の変化を検出', () => {
    const a = fixture(now), b = fixture(now); b.prefectures['13'].migration!.months['2026-10'].internationalOut.estimatedMonthCount *= 1.3;
    expect(() => validateChange(a, b)).toThrow('20%');
  });
  it('参考人口は公式基準から原値を積算し、未公表月だけ予測して月境界を連続させる', () => {
    const data = fixture(now), code = '13';
    const vital = data.history.vital;
    const source = data.national.vital.source;
    const migration = { domesticSource: source, internationalSource: source, rows: vital.map(v => ({ month: v.month, regions: { [code]: { domesticIn: 120, domesticOut: 100, internationalIn: 80, internationalOut: 30 } } })) };
    const base = { month: '2026-03', value: 14000000, source: { ...source, sourcePeriod: '2026-03' } };
    const result = referenceModel(base, vital, migration, code, ['2026-05', '2026-06']);
    const observedDelta = vital.filter(v => v.month >= base.month).reduce((sum, v) => sum + v.regions[code].birth - v.regions[code].death + 70, 0);
    expect(result.months['2026-05'].baseValue).toBe(base.value + observedDelta);
    const may = eventModel(vital, code, '2026-05');
    expect(result.months['2026-05'].ratePerSecond * secondsInMonth('2026-05')).toBeCloseTo(may.birth.estimatedMonthCount - may.death.estimatedMonthCount + 70);
    expect(result.months['2026-06'].baseValue).toBeCloseTo(result.months['2026-05'].baseValue + result.months['2026-05'].ratePerSecond * secondsInMonth('2026-05'));
    expect(Date.parse(result.officialBaseDate)).toBe(monthStart('2026-03'));
    const move = migrationModel(migration, code, '2026-05'); expect(move.domesticIn.estimatedMonthCount).toBe(120);
  });
});
