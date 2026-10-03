import {signed} from '../lib/formatting';
import type {RegionalDetail,PopulationGroup} from '../types/statistics';
export function RegionalIndicators({data,group}:{data:RegionalDetail;group:PopulationGroup}){
  const indicators=data.indicators;if(!indicators)return null;
  const movement=data.annual.migration[group];
  const natural=group==='foreign'?undefined:data.annual.japanese.birth-data.annual.japanese.death;
  const netMovement=movement.domesticIn+movement.internationalIn-movement.domesticOut-movement.internationalOut;
  return <div className="map-indicators">
    <div><span>平均年齢</span><strong>{indicators.averageAge.values[group].toFixed(1)}<small>歳</small></strong></div>
    {data.geography&&<><div className="regional-area"><span>面積</span><strong>{data.geography.areaKm2.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2})}<small>km²</small></strong></div>
    <div className="regional-density"><span>人口密度{group!=='total'&&<small>総人口</small>}</span><strong>{data.geography.populationDensity.toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1})}<small>人/km²</small></strong></div></>}
    <div className="regional-natural-change"><span>自然増減<small>{group==='total'?'日本人 · ':''}{data.annual.year}年</small></span><strong>{natural===undefined?<small>データなし</small>:<>{signed(natural)}<small>人</small></>}</strong></div>
    <div className="regional-migration-change"><span>移動による増減<small>{data.annual.year}年</small></span><strong>{signed(netMovement)}<small>人</small></strong></div>
    <div><span>合計特殊出生率<small>{group!=='foreign'&&`日本人 · ${indicators.birthRate.year}年`}</small></span><strong>{group==='foreign'?<small>データなし</small>:indicators.birthRate.totalFertilityRate.toFixed(2)}</strong></div>
  </div>;
}
