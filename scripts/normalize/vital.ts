import { parse } from 'csv-parse/sync';
import { PREFECTURES } from '../../src/lib/prefectures';
import { EVENTS, type MonthlyEvents, type Source, type VitalObservation } from '../../src/types/statistics';
const clean = (s: string) => s.normalize('NFKC').replace(/[\s　]/g, '');
export function normalizeVital(csv: string, source: Source): VitalObservation {
  const rows = parse(csv, { bom: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
  const period = clean(rows[0]?.[0] ?? '').match(/\((\d{4})\)年(\d{1,2})月分/);
  if (!period || `${period[1]}-${period[2].padStart(2, '0')}` !== source.sourcePeriod) throw new Error('CSV内の統計年月が一覧と一致しません');
  const header = rows.find(row => row.filter(cell => clean(cell) === '出生数').length >= 1 && row.some(cell => clean(cell) === '婚姻件数'));
  if (!header) throw new Error('人口動態CSVの列構成が変わりました');
  const indices = ['出生数', '死亡数', '婚姻件数', '離婚件数'].map(label => header.findIndex(c => clean(c) === label));
  if (indices.some(i => i < 0)) throw new Error('人口動態CSVの必須列がありません');
  const names = new Map<string, string>([['全国', '00']]);
  for (const p of PREFECTURES) {
    names.set(p.name, p.code);
    names.set(p.code + p.name.replace(/[都府県]$/, ''), p.code);
    names.set(p.code + p.name, p.code);
  }
  const regions: Record<string, MonthlyEvents> = {};
  let monthlySection = false;
  for (const row of rows) {
    const prefix = row.slice(0, indices[0]).map(clean);
    const periodLabel = prefix.some(cell => ['当月', `${Number(source.sourcePeriod.slice(5))}月`].includes(cell));
    const code = prefix.map(cell => names.get(cell)).find(Boolean);
    // Older CSVs use a separate section heading; newer CSVs repeat the period on every row.
    if (!code) {
      if (periodLabel) monthlySection = true;
      else if (prefix.some(cell => /累計|年計|前年/.test(cell))) monthlySection = false;
      continue;
    }
    if (prefix.some(cell => /累計|年計|前年/.test(cell))) continue;
    if (!periodLabel && !monthlySection) continue;
    if (!code) continue; // Exclude designated cities, foreign addresses and unknown addresses.
    if (regions[code]) throw new Error(`人口動態の地域が重複: ${code}`);
    regions[code] = Object.fromEntries(EVENTS.map((key, k) => {
      const raw = clean(row[indices[k]] ?? '').replace(/,/g, '');
      // e-Stat vital tables use '-' for no occurrences, not an unknown value.
      const value = raw === '-' ? 0 : /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`人口動態の欠損・不正値: ${code}/${key}`);
      return [key, value];
    })) as MonthlyEvents;
  }
  if (Object.keys(regions).length !== 48) throw new Error(`全国と47都道府県が揃いません: ${Object.keys(regions).length}`);
  return { month: source.sourcePeriod, regions, source };
}
