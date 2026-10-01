import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { discoverExactSex, normalizeExactSex } from '../scripts/sources/exact-sex';
import type { Table } from '../scripts/sources/table';
function sample(): Table {
  const cls = (id: string, names: string[]) => ({ '@id': id, '@name': id, CLASS: names.map((name,i) => ({ '@code': String(i), '@name': name })) });
  const classes = [cls('tab',['人口']), cls('cat01',['人口','出生児数']),cls('cat02',['男女計','男','女']),cls('cat03',['総人口','日本人人口','外国人人口']),cls('time',['2024年10月1日現在'])];
  const n = [[100003,50001,50002],[100000,50000,50000],[3,1,2]];
  return {classes, source:{publisher:'総務省統計局',statistics:'人口推計',table:'mock',status:'fixture',url:'https://www.e-stat.go.jp/',publishedAt:'2025-04-14',retrievedAt:'2026-10-01T00:00:00Z',scope:'検証用'},values:n.flatMap((group,g)=>group.map((value,s)=>({'@tab':'0','@cat01':'0','@cat02':String(s),'@cat03':String(g),'@time':'0','@unit':'人','$':String(value)})))};
}
it('公式一覧から全国の最新年次表を選び、都道府県・年齢表を除く', async () => {
  expect(discoverExactSex(await readFile('tests/fixtures/exact-sex-list.html','utf8'))).toBe('0004026260');
});
it('男女別の1人単位の値を丸めず、年次基準日を保持', () => {
  const data=normalizeExactSex(sample());expect(data.groups.total.male).toBe(50001);expect(data.groups.total.female).toBe(50002);expect(data.source.sourcePeriod).toBe('2024-10');
});
it('千人単位・欠損・二重取得を正確な原値として扱わない', () => {
  const a=sample();a.values[0]['@unit']='千人';expect(()=>normalizeExactSex(a)).toThrow('1人単位');
  const b=sample();b.values.pop();expect(()=>normalizeExactSex(b)).toThrow('欠損');
  const c=sample();c.values.push(c.values[0]);expect(()=>normalizeExactSex(c)).toThrow('重複');
});
