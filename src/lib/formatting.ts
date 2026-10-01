export const number = (n: number) => Math.round(n).toLocaleString('ja-JP');
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${number(Math.abs(n))}`;
export const monthLabel = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
export const dateTime = (now: number) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
export function intervalLabel(rate: number, unit: string) {
  if (rate <= 0) return '推計ペース 0';
  const seconds = 1 / rate;
  return seconds < 120 ? `約${number(seconds)}秒に1${unit}` : seconds < 7200 ? `約${number(seconds / 60)}分に1${unit}` : `約${number(seconds / 3600)}時間に1${unit}`;
}
