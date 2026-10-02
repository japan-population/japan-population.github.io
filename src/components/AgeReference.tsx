import type {z} from 'zod';
import type {ageReferenceSchema} from '../types/statistics';
import {number} from '../lib/formatting';
export function AgeReference({data}:{data:z.infer<typeof ageReferenceSchema>}){
  return <div className="age-reference">
    <h3>{data.age} <small>（{data.scopeLabel}）</small></h3>
    <dl>{([['男女計','total'],['男性','male'],['女性','female']]as const).map(([label,key])=><div key={key}><dt>{label}</dt><dd>{number(data[key])}<small> 人</small></dd></div>)}</dl>
    <p className="small-note">沖縄を含む100歳以上の内訳は未確認のため、グラフの最上段はまとめた年齢区分で表示しています。この人数はグラフ内の人数に含まれます。</p>
  </div>;
}
