// Largest remainder allocation conserves each national sex/age total exactly.
export function allocateRegional(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isFinite(w)||w<0))throw Error('地域配分の入力が不正です');
 const sum=weights.reduce((s,v)=>s+v,0);if(sum<=0)throw Error('地域配分の重みがありません');
 const raw=weights.map(w=>total*w/sum),counts=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,f:v-counts[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let n=total-counts.reduce((s,v)=>s+v,0),i=0;i<n;i++)counts[order[i].i]++;
 return counts;
}
