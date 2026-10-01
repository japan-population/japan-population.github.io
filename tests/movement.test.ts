import { expect, it } from 'vitest';
import { movement } from '../src/lib/movement';
import { estimatePeriod } from '../src/lib/estimate';
import { fixture } from '../scripts/build-fixture';
const now = Date.parse('2026-10-16T12:00:00+09:00'), month = '2026-10';
it('全国は国内移動を除き、国外のみを表示', () => {
  const migration = fixture(now).national.migration!;
  const result = movement(migration, month, 'inflow', true);
  expect(result.model?.estimatedMonthCount).toBe(migration.months[month].internationalIn.estimatedMonthCount);
  expect(result.year?.officialCount).toBe(migration.yearToDate![month].internationalIn.officialCount);
});
it('都道府県は国内・国外を合算してから整数化し、今年の原値も合算', () => {
  const migration = fixture(now).prefectures['13'].migration!;
  const result = movement(migration, month, 'outflow', false);
  expect(result.model?.estimatedMonthCount).toBe(migration.months[month].internationalOut.estimatedMonthCount + migration.months[month].domesticOut.estimatedMonthCount);
  expect(result.year?.officialCount).toBe(migration.yearToDate![month].internationalOut.officialCount + migration.yearToDate![month].domesticOut.officialCount);
  expect(estimatePeriod(result.model, month, now, 'year', result.year)).toBeGreaterThan(result.year!.officialCount);
});
it('移動の未取得を0と表示しない', () => {
  expect(movement(undefined, month, 'inflow', true)).toEqual({});
  expect(estimatePeriod(movement(undefined, month, 'inflow', false).model,month,now,'day')).toBeNull();
});
