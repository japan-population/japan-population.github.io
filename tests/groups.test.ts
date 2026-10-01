import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fixture } from '../scripts/build-fixture';
import { nationalIndicators } from '../src/lib/groups';
import { validateDataset } from '../scripts/validation';
import { normalizeNationalEvents } from '../scripts/sources/national-events';
import map from '../src/assets/japan-map.json';
const now = Date.parse('2026-10-01T12:00:00+09:00');
describe('国籍別人口動態と地図', () => {
  it('区分別の出生・移動を使い、未対応の婚姻を流用しない', () => {
    const n = fixture(now).national;
    const total = nationalIndicators(n,'total'), japanese = nationalIndicators(n,'japanese'), foreign = nationalIndicators(n,'foreign');
    for (const key of ['birth','death','inflow','outflow'] as const) {
      expect(total[key]!.months['2026-10'].estimatedMonthCount).toBeGreaterThan(japanese[key]!.months['2026-10'].estimatedMonthCount);
      expect(foreign[key]!.months['2026-10'].estimatedMonthCount).toBeGreaterThan(0);
    }
    expect(total.marriage).toBeUndefined(); expect(foreign.divorce).toBeUndefined(); expect(japanese.marriage).toBeDefined();
  });
  it('旧JSONでも日本人の人口動態を総数・外国人には表示しない', () => {
    const n = fixture(now).national; delete n.eventsByGroup;
    expect(nationalIndicators(n,'total').birth).toBeUndefined();
    expect(nationalIndicators(n,'foreign')).toEqual({});
    expect(nationalIndicators(n,'japanese').birth).toBeDefined();
  });
  it('国籍別の欠損と不正な年間平均を検出する', () => {
    const d = fixture(now); delete d.national.eventsByGroup!.foreign.inflow;
    expect(()=>validateDataset(d)).toThrow('国籍別');
    const b = fixture(now); b.national.eventsByGroup!.total.birth!.yearToDate['2026-10'].averagePerDay = 1;
    expect(()=>validateDataset(b)).toThrow('年間');
  });
  it('地図47県と同じ基準日の国籍別公式人口がそろう', () => {
    const d=fixture(now); expect(new Set(map.paths.map(p=>p.code)).size).toBe(47);
    for(const p of map.paths) { const v=d.prefectures[p.code].officialPopulation!; expect(v.total.value-v.japanese.value).toBe(v.foreign.value); expect(v.total.source.sourcePeriod).toBe(v.japanese.source.sourcePeriod); }
  });
  it('公式参考Excelから丸めずに国籍別出生・死亡を抽出する', async () => {
    const rows=await normalizeNationalEvents(await readFile('tests/fixtures/population-reference-2026-09.xlsx'),{publisher:'総務省統計局',statistics:'人口推計',table:'参考表',publishedAt:'2026-09-24',retrievedAt:new Date(now).toISOString(),url:'https://www.e-stat.go.jp/',status:'final',scope:'テスト'});
    expect(rows.at(-1)?.month).toBe('2026-03');
    expect(rows.at(-1)?.values).toEqual({total:{birth:52804,death:135811},japanese:{birth:50750,death:135040},foreign:{birth:2054,death:771}});
  });
});
