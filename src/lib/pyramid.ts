import type { Breakdown } from '../types/statistics';
export function pyramidRows(rows: Breakdown['rows'], interval: 5 | 10) {
  const buckets = new Map<number, {age:string; male:number; female:number; total:number}>();
  for (const row of rows) {
    if (row.age === '総数') continue;
    const start = Math.floor(parseInt(row.age) / interval) * interval;
    const bucket = buckets.get(start) ?? {age:start >= 100 ? '100歳以上' : `${start}～${start + interval - 1}歳`,male:0,female:0,total:0};
    bucket[row.sex === '男' ? 'male' : row.sex === '女' ? 'female' : 'total'] += row.value;
    buckets.set(start,bucket);
  }
  return [...buckets.entries()].sort(([a],[b])=>b-a).map(([,row])=>row);
}
