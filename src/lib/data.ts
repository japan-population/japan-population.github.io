import { manifestSchema, nationalSchema, prefecturesSchema, mapRegionsSchema, type SiteData } from '../types/statistics';
export async function loadData(): Promise<SiteData> {
  const read = async (file: string) => { const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' }); if (!response.ok) throw new Error('統計データを読み込めませんでした'); return response.json() as Promise<unknown>; };
  const readRegions = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/regions.json`, {cache:'no-cache'});
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) return mapRegionsSchema.parse(await response.json());
    if (!response.ok && response.status !== 404) throw new Error('地域データを読み込めませんでした');
    const old = prefecturesSchema.parse(await read('prefectures.json'));
    return mapRegionsSchema.parse({generationId:old.generationId,prefectures:Object.fromEntries(Object.values(old.prefectures).map(p=>[p.code,{code:p.code,name:p.name,officialPopulation:p.officialPopulation??(p.population?{total:{value:p.population.officialBase,source:p.population.source}}:undefined)}]))});
  };
  const [m,n,regions] = await Promise.all([read('manifest.json'),read('national.json'),readRegions()]);
  const manifest=manifestSchema.parse(m), national=nationalSchema.parse(n);
  if(national.generationId!==manifest.generationId||regions.generationId!==manifest.generationId)throw new Error('データ更新中です。再読み込みしてください。');
  return {manifest,national,prefectures:regions.prefectures};
}
