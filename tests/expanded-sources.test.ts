import { expect, it } from 'vitest';
import { normalizeBreakdown } from '../scripts/sources/breakdown';
import { normalizeMigration } from '../scripts/sources/migration';
import { type Table, numeric } from '../scripts/sources/table';
import { PREFECTURES } from '../src/lib/prefectures';
import { addMonths } from '../src/lib/time';
const source: Table['source'] = { publisher: '総務省統計局', statistics: '試験用', table: 'mock', status: 'fixture', publishedAt: '2026-09-24', retrievedAt: '2026-10-01T00:00:00Z', url: 'https://www.e-stat.go.jp/', scope: '構造検証用' };
function populationTable(): Table {
  const cls = (id: string, names: string[]) => ({ '@id': id, '@name': id, CLASS: names.map((name,i) => ({ '@code': String(i), '@name': name })) });
  const times = Array.from({length:13},(_,i) => addMonths('2026-04',i-12));
  const ages = ['総数', ...Array.from({length:21},(_,i)=>i===20?'100歳以上':`${i*5}～${i*5+4}歳`)];
  const classes = [cls('tab',['人口']), cls('cat01',['確定値']), cls('cat02',['男女計','男','女']),cls('cat03',ages),cls('cat04',['総人口','日本人人口','外国人人口']),cls('area',['全国']),cls('time',times.map(t=>`${t.slice(0,4)}年${Number(t.slice(5))}月`))];
  const values: Table['values'] = [];
  for(let t=0;t<13;t++)for(let g=0;g<3;g++)for(let s=0;s<3;s++)for(let a=0;a<22;a++) values.push({'@tab':'0','@cat01':'0','@cat02':String(s),'@cat03':String(a),'@cat04':String(g),'@area':'0','@time':String(t),'@unit':'千人','$':String(10000 - t * 10 + g)});
  return {classes,values,source};
}
it('3人口区分・男女・21階級と総数を分類して千人から換算する',()=>{
  const result=normalizeBreakdown(populationTable());expect(result.rows).toHaveLength(198);expect(result.groups.total.base).toBe(9880000);expect(result.groups.total.yearAgo).toBe(10000000);expect(result.rows.find(r=>r.group==='foreign'&&r.sex==='女'&&r.age==='95～99歳')?.value).toBe(9882000);
});
it('人口内訳の欠損・重複・不明単位を拒否',()=>{
  const a=populationTable();a.values.pop();expect(()=>normalizeBreakdown(a)).toThrow('欠損');
  const b=populationTable();b.values.push(b.values[0]);expect(()=>normalizeBreakdown(b)).toThrow('重複');
  expect(()=>numeric({'@unit':'万人','$':'123'},[])).toThrow('単位');
});
function migrationTable(international: boolean): Table {
  const labels = international ? ['国外からの転入者数','国外への転出者数'] : ['他都道府県（他市町村）からの転入者数','他都道府県（他市町村）への転出者数'];
  const regions = [{code:'00',name:'全国'},...PREFECTURES];
  const classes = [{ '@id':'tab','@name':'表章項目',CLASS:labels.map((label,i)=>({'@code':String(i),'@name':label,'@unit':'人'})) },{'@id':'area','@name':'地域',CLASS:regions.map(p=>({'@code':`${p.code}000`,'@name':p.name}))},{'@id':'time','@name':'年月',CLASS:[{'@code':'t','@name':'2026年8月'}]}];
  return {source,classes,values:regions.flatMap(p=>labels.map((_,i)=>({'@tab':String(i),'@area':`${p.code}000`,'@time':'t','$':String((international?200:400)+i)})))};
}
it('国内・国外の異なる表を全国と47県に統合する',()=>{
  const history=normalizeMigration(migrationTable(false),migrationTable(true));expect(Object.keys(history.rows[0].regions)).toHaveLength(48);expect(history.rows[0].regions['13']).toEqual({domesticIn:400,domesticOut:401,internationalIn:200,internationalOut:201});expect(history.domesticSource.sourcePeriod).toBe('2026-08');
});
it('人口移動の地域欠損・重複・非数値を拒否',()=>{
  const a=migrationTable(false);a.values.pop();expect(()=>normalizeMigration(a,migrationTable(true))).toThrow('欠損');
  const b=migrationTable(false);b.values.push(b.values[0]);expect(()=>normalizeMigration(b,migrationTable(true))).toThrow('重複');
  const c=migrationTable(true);c.values[0].$='…';expect(()=>normalizeMigration(migrationTable(false),c)).toThrow('不正');
});
