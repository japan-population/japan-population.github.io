import type {RegionalDetail,PopulationGroup} from '../types/statistics';
export function RegionalIndicators({data,group}:{data:RegionalDetail;group:PopulationGroup}){
  const indicators=data.indicators;if(!indicators)return null;
  return <div className="map-indicators">
    <div><span>平均年齢</span><strong>{indicators.averageAge.values[group].toFixed(1)}<small>歳</small></strong></div>
    <div><span>合計特殊出生率<small>{group!=='foreign'&&`日本人 · ${indicators.birthRate.year}年`}</small></span><strong>{group==='foreign'?<small>データなし</small>:indicators.birthRate.totalFertilityRate.toFixed(2)}</strong></div>
    {data.geography&&<><div><span>面積</span><strong>{data.geography.areaKm2.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2})}<small>km²</small></strong></div>
    <div><span>人口密度{group!=='total'&&<small>総人口</small>}</span><strong>{data.geography.populationDensity.toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1})}<small>人/km²</small></strong></div></>}
  </div>;
}
