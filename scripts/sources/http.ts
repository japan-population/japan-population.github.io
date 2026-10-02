const ALLOWED = new Set(['www.e-stat.go.jp', 'api.e-stat.go.jp', 'www8.cao.go.jp']);
export async function download(url: URL): Promise<Uint8Array> {
  if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname)) throw new Error('許可されていない統計URL');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'error', headers: { 'User-Agent': 'JapanPopulationObservatory/0.1 (public statistics research)' } });
      if (!response.ok) throw new Error('HTTP error');
      return new Uint8Array(await response.arrayBuffer());
    } catch { if (attempt === 2) throw new Error(`公式統計の取得に失敗しました (${url.hostname})`); }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error('取得失敗');
}
export async function downloadText(url: URL): Promise<string> { return new TextDecoder().decode(await download(url)); }
