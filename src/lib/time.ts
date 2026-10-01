const JST_OFFSET = 9 * 60 * 60 * 1000;
export const DAY_SECONDS = 86400;
export function monthKey(now: number): string {
  return new Date(now + JST_OFFSET).toISOString().slice(0, 7);
}
export function monthStart(month: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Invalid month: ${month}`);
  return Date.parse(`${month}-01T00:00:00+09:00`);
}
export function addMonths(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + count, 1)).toISOString().slice(0, 7);
}
export function secondsInMonth(month: string): number {
  return (monthStart(addMonths(month, 1)) - monthStart(month)) / 1000;
}
export function dayStart(now: number): number {
  return Math.floor((now + JST_OFFSET) / (DAY_SECONDS * 1000)) * DAY_SECONDS * 1000 - JST_OFFSET;
}
