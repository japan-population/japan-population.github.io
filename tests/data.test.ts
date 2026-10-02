import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from '../scripts/build-fixture';
import { publishDataset, readDataset, semanticJSON } from '../scripts/dataset';
import { validateDataset, validateChange } from '../scripts/validation';
const now = Date.parse('2026-10-01T12:00:00+09:00');
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
describe('data integrity', () => {
  it('全国・47県・66か月の完全なfixture', () => { const d = fixture(now); expect(() => validateDataset(d)).not.toThrow(); expect(Object.keys(d.prefectures)).toHaveLength(47); expect(d.history.vital).toHaveLength(66); });
  it('欠けた県・コード不一致・負の原値を拒否', () => { const d = fixture(now); delete d.prefectures['47']; expect(() => validateDataset(d)).toThrow(); const n = fixture(now); n.history.vital[0].regions['13'].birth = -1; expect(() => validateDataset(n)).toThrow(); });
  it('公表日を必須にする', () => { const d = fixture(now); d.national.vital.source.publishedAt = ''; expect(() => validateDataset(d)).toThrow(); });
  it('実データにfixtureを混ぜない', () => { const d = fixture(now); d.manifest.mode = 'official'; expect(() => validateDataset(d)).toThrow('fixture'); });
  it('20%以上の変化を検出', () => { const a = fixture(now), b = fixture(now); b.national.population.base *= 1.21; expect(() => validateChange(a, b)).toThrow('20%'); });
  it('データ更新時刻だけの変更は無視', () => expect(semanticJSON(fixture(now))).toBe(semanticJSON(fixture(now + 10000))));
  it('公開前に検証し、失敗時は既存JSONを保つ', async () => {
    const root = await mkdtemp(join(tmpdir(), 'population-test-')); dirs.push(root); const path = join(root, 'data');
    const d = fixture(now); expect(await publishDataset(d, path)).toBe(true);
    const before = await readFile(join(path, 'national.json'), 'utf8');
    d.national.population.base = -1;
    await expect(publishDataset(d, path)).rejects.toThrow();
    expect(await readFile(join(path, 'national.json'), 'utf8')).toBe(before);
    expect(await publishDataset(fixture(now + 10000), path)).toBe(false);
    expect((await readDataset(path)).prefectures['13'].name).toBe('東京都');
  });
});
it('内訳のない旧JSONは読み取り可能でも公開不可、既存JSONを保持する',async()=>{
 const {validatePublication}=await import('../scripts/validation');
 const old=fixture(now),missing=structuredClone(old);
 delete missing.national.breakdown;delete missing.national.migration;
 for(const p of Object.values(missing.prefectures)){delete p.population;delete p.migration;}
 expect(()=>validateDataset(missing)).not.toThrow();
 expect(()=>validatePublication(missing)).toThrow('国籍別人口');
 expect(()=>validateChange(old,missing)).toThrow('人口内訳の削除');
 const root=await mkdtemp(join(tmpdir(),'population-publication-'));dirs.push(root);
 const path=join(root,'data');await publishDataset(old,path);
 const before=await readFile(join(path,'national.json'),'utf8');
 await expect(publishDataset(missing,path)).rejects.toThrow('国籍別人口');
 expect(await readFile(join(path,'national.json'),'utf8')).toBe(before);
});
it('全国の人口内訳を、廃止済み都道府県参考推計の有無に依存させない',async()=>{
 const {validatePublication}=await import('../scripts/validation');
 const d=fixture(now);delete d.national.migration;
 for(const p of Object.values(d.prefectures)){delete p.population;delete p.migration;}
 expect(()=>validatePublication(d)).not.toThrow();
 d.national.breakdown!.rows.pop();
 expect(()=>validatePublication(d)).toThrow('欠損');
});
