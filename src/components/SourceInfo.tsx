import type { Source } from '../types/statistics';
import { monthLabel } from '../lib/formatting';
export function SourceInfo({ source }: { source: Source }) {
  return <details className="source-details"><summary>データ基準：{monthLabel(source.sourcePeriod)} <span>出典・定義を見る ↗</span></summary><div><p><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}「{source.statistics}」 / {source.table}</a></p><p><span className="badge">{source.status === 'fixture' ? 'デモ原値' : source.status === 'final' ? '公式確定値' : '公式概数'}</span> 公表・更新日：{source.publishedAt} ／ 取得日：{source.retrievedAt.slice(0, 10)}</p><p>{source.scope}</p></div></details>;
}
