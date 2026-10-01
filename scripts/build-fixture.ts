import { resolve } from 'node:path';
import { PREFECTURES } from '../src/lib/prefectures';
import { addMonths, monthKey } from '../src/lib/time';
import { EVENTS, type PopulationObservation, type Source, type VitalObservation, type MonthlyEvents } from '../src/types/statistics';
import { populationModel } from './models/population-model';
import type { Breakdown } from '../src/types/statistics';
import type { MigrationHistory } from './sources/migration';
import { buildDataset, publishDataset } from './dataset';
export function fixture(now = Date.now()) {
  const latest = addMonths(monthKey(now), -6);
  const source = (month: string, statistics: string): Source => ({ publisher: 'デモ・架空データ', statistics, table: 'fixture', sourcePeriod: month, publishedAt: `${addMonths(month, 5)}-20`, retrievedAt: new Date(now).toISOString(), url: 'https://www.e-stat.go.jp/', status: 'fixture', scope: '画面・計算検証用の架空値。公式統計ではありません。' });
  const population: PopulationObservation[] = Array.from({ length: 66 }, (_, i) => { const month = addMonths(latest, i - 65); return { month, value: 126400000 - i * 44000, source: source(month, '人口推計（デモ）') }; });
  const vital: VitalObservation[] = Array.from({ length: 66 }, (_, i) => {
    const month = addMonths(latest, i - 65);
    const season = 1 + .09 * Math.cos((Number(month.slice(5)) - 1) / 12 * Math.PI * 2);
    const national = [64000, 123000, 44000, 17000].map((base, k) => Math.round(base * season * (1 + (k === 1 ? .002 : -.0015) * i)));
    const regions: Record<string, MonthlyEvents> = {};
    const weights = PREFECTURES.map((p, j) => p.code === '13' ? 11 : p.code === '27' ? 7 : p.code === '14' ? 7.3 : 1 + (j % 6) * .3);
    const total = weights.reduce((a, b) => a + b, 0);
    regions['00'] = Object.fromEntries(EVENTS.map((key, j) => [key, national[j]])) as MonthlyEvents;
    PREFECTURES.forEach((p, j) => { regions[p.code] = Object.fromEntries(EVENTS.map((key, k) => [key, Math.round(national[k] * weights[j] / total)])) as MonthlyEvents; });
    return { month, regions, source: source(month, '人口動態統計（デモ）') };
  });
  const groups = Object.fromEntries(['total', 'japanese', 'foreign'].map((g, i) => [g, populationModel(population.map(r => ({ ...r, value: Math.round(r.value * [1, .97, .03][i]) })))])) as Breakdown['groups'];
  const rows: Breakdown['rows'] = [];
  for (const group of ['total', 'japanese', 'foreign'] as const) for (const sex of ['男女計', '男', '女'] as const) {
    const fraction = sex === '男' ? .485 : sex === '女' ? .515 : 1;
    rows.push({ group, sex, age: '総数', value: Math.round(groups[group].base * fraction) });
    for (let i = 0; i < 21; i++) rows.push({ group, sex, age: i === 20 ? '100歳以上' : `${i * 5}～${i * 5 + 4}歳`, value: Math.round(groups[group].base * fraction / 21 * (1 + .35 * Math.sin(i))) });
  }
  const migration: MigrationHistory = { domesticSource: source(latest, '国内人口移動（デモ）'), internationalSource: source(latest, '国際人口移動（デモ）'), rows: vital.map(r => ({ month: r.month, regions: Object.fromEntries(Object.entries(r.regions).map(([code, v]) => [code, { domesticIn: v.birth * 3, domesticOut: v.birth * 3, internationalIn: v.marriage, internationalOut: v.divorce }])) })) };
  const baseMonth = `${Number(latest.slice(0, 4)) - 1}-10`;
  const bases = Object.fromEntries(PREFECTURES.map(p => [p.code, { month: baseMonth, value: p.code === '13' ? 14000000 : 2000000, source: source(baseMonth, '都道府県人口（デモ）') }]));
  return buildDataset(population, vital, 'fixture', now, { breakdown: { groups, rows, source: source(latest, '人口内訳（デモ）') }, migration, bases });
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/build-fixture.ts')) {
  // Fixture writes are explicit and cannot silently replace official data.
  const { readFile } = await import('node:fs/promises');
  try { const manifest = JSON.parse(await readFile('public/data/manifest.json', 'utf8')) as { mode: string }; if (manifest.mode === 'official') throw new Error('実データはfixtureで上書きできません'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  console.log(await publishDataset(fixture()) ? 'デモJSONを生成しました（架空値）' : '変更なし');
}
