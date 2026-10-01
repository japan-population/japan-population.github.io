import { expect, it } from 'vitest';
import { yearModel } from '../scripts/models/year-model';
import { estimatePeriod } from '../src/lib/estimate';
import { fixture } from '../scripts/build-fixture';
import { secondsInMonth } from '../src/lib/time';
const model = (month: string) => ({ estimatedMonthCount: 3100, ratePerSecond: 3100 / secondsInMonth(month), seasonalBase: 3100, trendFactor: 1 });
it('公表済み4か月＋未公表5か月＋10月の経過分を合算', () => {
  const annual = yearModel(['birth'], '2026-10', '2026-04', () => ({ birth: 1000 }), () => ({ birth: 2000 })).birth;
  expect(annual).toEqual({ officialCount: 4000, estimatedBeforeMonth: 10000, officialThrough: '2026-04' });
  const now = Date.parse('2026-10-16T12:00:00+09:00');
  expect(estimatePeriod(model('2026-10'), '2026-10', now, 'year', annual)).toBe(15550);
  expect(estimatePeriod(model('2026-10'), '2026-10', now, 'day')).toBe(50);
});
it('新たな公表月は推計分を原値に置換し、二重計上しない', () => {
  const annual = yearModel(['birth'], '2026-10', '2026-05', () => ({ birth: 1000 }), () => ({ birth: 2000 })).birth;
  expect(annual.officialCount).toBe(5000); expect(annual.estimatedBeforeMonth).toBe(8000);
});
it('JST元日で0に戻り、前年の公表月を累計に含めない', () => {
  const annual = yearModel(['birth'], '2027-01', '2026-06', () => { throw Error('前年は取得しない'); }, () => { throw Error('終了月なし'); }).birth;
  expect(annual).toEqual({ officialCount: 0, estimatedBeforeMonth: 0, officialThrough: null });
  expect(estimatePeriod(model('2027-01'), '2027-01', Date.parse('2026-12-31T15:00:00Z'), 'year', annual)).toBe(0);
  expect(estimatePeriod(model('2027-01'), '2027-01', Date.parse('2026-12-31T14:59:59Z'), 'year', annual)).toBeNull();
});
it('うるう年2月は29日分を積算', () => {
  const month = '2024-02'; const m = { ...model(month), ratePerSecond: 1 / 86400, estimatedMonthCount: 29 };
  expect(estimatePeriod(m, month, Date.parse('2024-02-29T12:00:00+09:00'), 'year', { officialCount: 31, estimatedBeforeMonth: 0, officialThrough: '2024-01' })).toBe(59);
});
it('公表済みの欠損を推計やゼロで隠さない', () => {
  expect(() => yearModel(['birth'], '2026-10', '2026-04', () => undefined, () => ({ birth: 100 }))).toThrow('欠損');
  expect(estimatePeriod(model('2026-10'), '2026-10', Date.parse('2026-10-01T00:00:00+09:00'), 'year')).toBeNull();
});
it('全国・47県の出生と人口移動に年累計を生成し、未来モデルの年越しにも対応', () => {
  const data = fixture(Date.parse('2026-11-01T00:00:00+09:00'));
  for (const region of [data.national, ...Object.values(data.prefectures)]) {
    expect(region.vital.yearToDate?.['2026-11'].birth.officialCount).toBeGreaterThan(0);
    expect(region.vital.yearToDate?.['2027-01'].birth.officialCount).toBe(0);
    expect(region.migration?.yearToDate?.['2027-01'].domesticIn.estimatedBeforeMonth).toBe(0);
  }
});
