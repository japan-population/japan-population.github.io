import { expect, it } from 'vitest';
import { pyramidRows } from '../src/lib/pyramid';
import { fixture } from '../scripts/build-fixture';
it('10歳階級は隣り合う5歳階級を合算し、100歳以上は独立して保持する',()=>{
  const rows=fixture(Date.parse('2026-10-02T00:00:00+09:00')).national.breakdown!.rows.filter(r=>r.group==='total');
  const five=pyramidRows(rows,5),ten=pyramidRows(rows,10);
  expect(five).toHaveLength(21);expect(ten).toHaveLength(11);
  expect(ten[0]).toEqual(five[0]);
  for(const sex of ['male','female','total'] as const){
    expect(ten.at(-1)![sex]).toBe(five.at(-1)![sex]+five.at(-2)![sex]);
    expect(ten.reduce((n,r)=>n+r[sex],0)).toBe(five.reduce((n,r)=>n+r[sex],0));
  }
});
