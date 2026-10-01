import { manifestSchema, nationalSchema, prefecturesSchema, type DashboardData } from '../types/statistics';
export async function loadData(): Promise<DashboardData> {
  const read = async (file: string) => { const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' }); if (!response.ok) throw new Error('統計データを読み込めませんでした'); return response.json() as Promise<unknown>; };
  const [m, n, p] = await Promise.all(['manifest.json', 'national.json', 'prefectures.json'].map(read));
  const manifest = manifestSchema.parse(m), national = nationalSchema.parse(n), prefectures = prefecturesSchema.parse(p);
  if (national.generationId !== manifest.generationId || prefectures.generationId !== manifest.generationId) throw new Error('データ更新中です。再読み込みしてください。');
  return { manifest, national, prefectures: prefectures.prefectures };
}
