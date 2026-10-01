import { fetchPopulation } from './sources/population';
import { fetchVital } from './sources/vital';
import { buildDataset, publishDataset } from './dataset';
try {
  const appId = process.env.ESTAT_APP_ID?.trim();
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です。GitHub Repository Secretに登録し、Update statisticsワークフローから実行してください。既存JSONは変更しません。');
  const now = Date.now();
  const population = await fetchPopulation(appId, now);
  console.log(`人口推計: ${population.length}か月を検証`);
  const vital = await fetchVital(now);
  const data = buildDataset(population, vital, 'official', now);
  console.log(await publishDataset(data) ? 'すべての検証に成功し、JSONを更新しました。' : '統計・推計モデルの変更はありません。');
} catch (error) {
  // Only local controlled errors are printed. Zod diagnostics can include source input; avoid dumping them.
  const message = error instanceof Error ? error.message : 'データ更新に失敗しました';
  const secret = process.env.ESTAT_APP_ID;
  console.error(secret ? message.split(secret).join('[REDACTED]') : message);
  process.exitCode = 1;
}
