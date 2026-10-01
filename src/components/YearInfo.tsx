import type { YearTotal, Source } from '../types/statistics';
import { monthLabel } from '../lib/formatting';
export function YearInfo({ year, month, source }: { year?: YearTotal; month: string; source: Source }) {
  if (!year) return <p className="warning">今年の累計データがありません。データ更新後に表示します。</p>;
  const status = source.status === 'provisional' ? '公式概数' : source.status === 'fixture' ? 'デモ原値' : '公式確定値';
  return <p className="section-note">{month.slice(0, 4)}年1月1日から現在まで。{year.officialThrough ? `${monthLabel(year.officialThrough)}までの${status}と、それ以降の推計を合算しています。` : '今年の公表値がまだないため、全期間が推計です。'}未公表の終了月は月全体、今月は現在までの経過分を加算します。統計が公表・改訂されると累計値も更新されます。</p>;
}
