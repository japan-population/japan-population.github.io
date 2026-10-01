import { useEffect, useState } from 'react';
import { loadData } from './lib/data';
import { useClock } from './hooks/useClock';
import { populationGroups, type PopulationGroup, type SiteData } from './types/statistics';
import { Home } from './pages/Home';
import { GROUP_LABELS } from './lib/groups';
export default function App() {
  const [data, setData] = useState<SiteData>();
  const [error, setError] = useState('');
  const [group, setGroup] = useState<PopulationGroup>('total');
  const now = useClock();
  useEffect(() => { let active = true; void loadData().then(d => { if (active) setData(d); }).catch(() => { if (active) setError('統計データを読み込めませんでした。更新中の場合は、少し待って再読み込みしてください。'); }); return () => { active = false; }; }, []);
  return <><a className="skip-link" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>本文へ移動</a><header className="site-header"><a className="brand" href="#/"><span className="brand-mark" aria-hidden="true">◉</span><span>日本人口観測所<small>JAPAN POPULATION OBSERVATORY</small></span></a><div className="nationality-switch" role="group" aria-label="表示する人口区分"><span className="switch-thumb" style={{transform:`translateX(${populationGroups.indexOf(group)*100}%)`}}/>{populationGroups.map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{GROUP_LABELS[g]}</button>)}</div></header>
    <main id="main" tabIndex={-1}>{data?.manifest.mode === 'fixture' && <aside className="demo-banner"><strong>DEMO / デモデータ</strong><span>画面検証用の架空値です。実際の人口・人口動態を示していません。</span></aside>}{error ? <section className="error" role="alert"><h1>データを読み込めませんでした</h1><p>{error}</p><button onClick={() => window.location.reload()}>再読み込み</button></section> : !data ? <p className="loading" role="status">統計データを読み込んでいます…</p> : <Home data={data} now={now} group={group}/>}
    <section id="about" className="about section"><div><span className="eyebrow">METHODOLOGY</span><h2>統計と推計方法</h2></div><div><h3>この数字は、公的統計からの推計です。</h3><p>リアルタイムの行政データではありません。総人口は最新確定値と12か月前の人口差から外挿し、人口動態は過去3年の同月平均と直近12か月のトレンドから推計しています。</p><p>カウンターが動くタイミングは、実際の出生・死亡などの発生時刻を表しません。日・月の途中までの値と、月全体の予測を区別して表示しています。</p><div className="badge-guide"><span><b>公式確定値</b>政府が公表した確定値</span><span><b>公式概数</b>政府が公表した概数</span><span><b>推計</b>本サイトが算出した値</span><span><b>参考推計</b>複数統計を組み合わせた値</span></div></div></section>
    </main><footer><div className="footer-top"><div className="brand"><span className="brand-mark">◉</span><span>日本人口観測所<small>JAPAN POPULATION OBSERVATORY</small></span></div><p>公的統計の最新公表値を基にしたリアルタイム推計</p></div><div className="footer-bottom"><span>データ出典</span><a href="https://www.stat.go.jp/data/jinsui/">総務省統計局「人口推計」 ↗</a><a href="https://www.stat.go.jp/data/idou/">総務省統計局「住民基本台帳人口移動報告」 ↗</a><a href="https://www.mhlw.go.jp/toukei/list/81-1.html">厚生労働省「人口動態統計」 ↗</a><a href="https://www.e-stat.go.jp/">政府統計の総合窓口 e-Stat ↗</a></div><p className="small-note">e-Stat APIを利用して取得した統計データを、本サイトが加工して表示します。政府機関が本サイトの推計を保証するものではありません。</p></footer></>;
}
