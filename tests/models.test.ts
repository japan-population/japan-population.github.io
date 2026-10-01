import { describe, expect, it } from 'vitest';
import { estimateCounter, estimateEvent } from '../src/lib/estimate';
import { addMonths, dayStart, monthKey, monthStart, secondsInMonth } from '../src/lib/time';
import { eventModel } from '../scripts/models/event-model';
import { populationModel } from '../scripts/models/population-model';
import { fixture } from '../scripts/build-fixture';
const now = Date.parse('2026-10-01T12:00:00+09:00');
const data = fixture(now);
describe('population', () => {
  const p = data.national.population;
  const model = { baseValue: p.base, baseTimestamp: Date.parse(p.baseDate), ratePerSecond: p.ratePerSecond };
  it('基準時刻で原値と一致する', () => expect(estimateCounter(model, model.baseTimestamp)).toBe(p.base));
  it('負の速度は時刻に従って減少する', () => expect(estimateCounter(model, model.baseTimestamp + 86400000)).toBeLessThan(p.base));
  it('スリープ後も経過時間から再計算する', () => expect(estimateCounter(model, model.baseTimestamp + 86400000 * 10)).toBeCloseTo(p.base + p.ratePerSecond * 864000));
  it('12か月前が欠けていると生成しない', () => expect(() => populationModel(data.history.population.filter(p => p.month !== '2025-04'))).toThrow('12か月前'));
});
describe('JST time and event counters', () => {
  const model = { estimatedMonthCount: 31000, ratePerSecond: 31000 / secondsInMonth('2026-10'), seasonalBase: 31000, trendFactor: 1 };
  it('JST月初に0', () => expect(estimateEvent(model, '2026-10', monthStart('2026-10'), 'month')).toBe(0));
  it('月末直前に月間予測へ近づく', () => expect(estimateEvent(model, '2026-10', monthStart('2026-11') - 1, 'month')).toBe(30999));
  it('JSTの日次カウンターは午前0時にリセット', () => expect(estimateEvent(model, '2026-10', Date.parse('2026-10-02T00:00:00+09:00'), 'day')).toBe(0));
  it('UTCではまだ前月でもJSTでは翌月', () => expect(monthKey(Date.parse('2026-09-30T15:00:00Z'))).toBe('2026-10'));
  it('日付境界は閲覧者のTZに依存しない', () => expect(dayStart(now)).toBe(Date.parse('2026-09-30T15:00:00Z')));
  it('閏年の2月は29日', () => { expect(secondsInMonth('2024-02')).toBe(29 * 86400); expect(secondsInMonth('2025-02')).toBe(28 * 86400); });
  it('年境界を越える', () => expect(addMonths('2026-12', 1)).toBe('2027-01'));
  it('有効期間外は古い速度を流用しない', () => expect(estimateEvent(model, '2026-10', monthStart('2026-11'), 'month')).toBeNull());
  it('0件は無限大やNaNにならない', () => expect(estimateEvent({ ...model, ratePerSecond: 0 }, '2026-10', now, 'day')).toBe(0));
});
describe('seasonal model', () => {
  it('3年同月平均に直近12か月/前12か月を掛ける', () => {
    const rows = structuredClone(data.history.vital);
    rows.forEach(row => { row.regions['13'].birth = 100; });
    // Latest 12 months are 2025-05 through 2026-04. October 2025 is also a seasonal observation.
    rows.filter(row => row.month >= '2025-05').forEach(row => { row.regions['13'].birth = 200; });
    const model = eventModel(rows, '13', '2026-10').birth;
    expect(model.seasonalBase).toBeCloseTo(400 / 3);
    expect(model.trendFactor).toBe(2);
    expect(model.estimatedMonthCount).toBeCloseTo(800 / 3);
  });
  it('連続24か月の欠損を0として埋めない', () => expect(() => eventModel(data.history.vital.filter(r => r.month !== '2025-05'), '00', '2026-10')).toThrow('欠損'));
  it('同月3年分の欠損を拒否する', () => expect(() => eventModel(data.history.vital.filter(r => r.month !== '2023-10'), '00', '2026-10')).toThrow('欠損'));
  it('分母0を拒否する', () => { const rows = structuredClone(data.history.vital); rows.forEach(r => { r.regions['00'].birth = 0; }); expect(() => eventModel(rows, '00', '2026-10')).toThrow('分母'); });
});
