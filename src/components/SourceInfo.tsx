import type { Source } from '../types/statistics';
import { monthLabel } from '../lib/formatting';
type SourceInfoProps = ({ source: Source; sources?: never } | { source?: never; sources: readonly Source[] }) & { showPeriod?: boolean };
// One disclosure per statistics block: pass all relevant sources through `sources`.
// Do not render consecutive SourceInfo components for the same block.
export function SourceInfo(props: SourceInfoProps) {
  const sources = props.sources ?? [props.source];
  const periods = [...new Set(sources.map(source => monthLabel(source.sourcePeriod)))];
  return <details className="source-details">
    <summary>{props.showPeriod===false?'出典・定義を見る ↗':<>データ基準：{periods.join('・')} <span>出典・定義を見る ↗</span></>}</summary>
    {sources.map((source, index) => <div key={index}>
      <p><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}「{source.statistics}」 / {source.table}</a></p>
      <p><span className="badge">{source.status === 'reference' ? '参考推計' : source.status === 'projection' ? '公的将来推計' : source.status === 'fixture' ? 'デモ原値' : source.status === 'final' ? '公式確定値' : '公式概数'}</span> 公表・更新日：{source.publishedAt} ／ 取得日：{source.retrievedAt.slice(0, 10)}</p>
      <p>{source.scope}</p>
    </div>)}
  </details>;
}
