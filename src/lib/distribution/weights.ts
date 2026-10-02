export function normalizeWeights(weights: readonly number[]): number[] {
  if (!weights.length || weights.some(w=>!Number.isFinite(w)||w<0)) throw new Error('weights must be finite and nonnegative');
  // Scaling avoids overflow when finite input weights are very large.
  const max=Math.max(...weights); if(max<=0)throw new Error('weights total must be greater than zero');
  const scaled=weights.map(w=>w/max), total=scaled.reduce((a,b)=>a+b,0);
  return scaled.map(w=>w/total);
}
/** Exclusive prefix: prefix[i] is the total before item i. */
export function buildPrefixSums(values:readonly number[]):number[]{
  const prefix=[0]; for(const v of values){if(!Number.isFinite(v)||v<0)throw new Error('Invalid count');const next=prefix.at(-1)!+v;if(!Number.isFinite(next))throw new Error('Count overflow');prefix.push(next);}return prefix;
}
