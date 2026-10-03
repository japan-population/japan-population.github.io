import {extendRegionalProjections} from './models/regional-projection';
import {fetchRegionalTimeline} from './sources/regional-timeline';
import {fetchRegionalDetails} from './sources/regional-details';
import {fetchEventBreakdowns} from './sources/event-breakdowns';
import {fetchFinal2025,mergeFinalRelease} from './sources/vital-final-release';
import {fetchProjections} from './sources/projections';
import {fetchPopulationTrend} from './sources/population-trend';
import { fetchOfficialArchive } from './sources/official-archive';
import { fetchDistribution } from './sources/distribution';
import { fetchCensusData } from './sources/census-regions';
import { fetchNationalEvents } from './sources/national-events';
import { fetchExactPopulation } from './sources/exact-population';
import { populationModel } from './models/population-model';
import { populationGroups } from '../src/types/statistics';
import { fetchPopulation } from './sources/population';
import { fetchBreakdown, fetchPrefectureBases } from './sources/breakdown';
import { fetchMigration } from './sources/migration';
import { fetchVital } from './sources/vital';
import { buildDataset, publishDataset } from './dataset';
try {
  const appId = process.env.ESTAT_APP_ID?.trim();
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です。GitHub Repository Secretに登録し、Update statisticsワークフローから実行してください。既存JSONは変更しません。');
  const now = Date.now();
  let population = await fetchPopulation(appId, now);
  console.log(`人口推計: ${population.length}か月を検証`);
  const vital = await fetchVital(now);
  const breakdown = await fetchBreakdown(appId, now);
  const exact = await fetchExactPopulation(now);
  for (const group of populationGroups) {
    const precise = populationModel(exact[group]);
    const rounded = breakdown.groups[group];
    if (precise.baseDate !== rounded.baseDate || Math.abs(precise.base - rounded.base) > 500 || Math.abs(precise.yearAgo - rounded.yearAgo) > 500) throw new Error('1人単位の参考表と千人単位の人口表が一致しません');
    breakdown.groups[group] = precise;
  }
  const exactByMonth = new Map(exact.total.map(r => [r.month, r]));
  population = population.map(r => exactByMonth.get(r.month) ?? r);
  const bases = await fetchPrefectureBases(appId, now);
  const migration = await fetchMigration(appId, now);
  const japaneseBases = await fetchPrefectureBases(appId, now, 'japanese');
  const japaneseMigration = await fetchMigration(appId, now, 'japanese');
  const foreignMigration = await fetchMigration(appId, now, 'foreign');
  const nationalEvents = await fetchNationalEvents(now);
  const { officialRegions, nationalities } = await fetchCensusData(now);
  const regionalTimeline = await fetchRegionalTimeline(now,appId);
  const regionalDetails = await fetchRegionalDetails(now);
  const distribution = await fetchDistribution(now);
  const archive = await fetchOfficialArchive(appId, now);
  const mergedFinal = mergeFinalRelease(archive.annual,await fetchEventBreakdowns(appId,now,archive.annual),await fetchFinal2025(now));
  archive.annual=mergedFinal.annual;
  const eventBreakdowns=mergedFinal.breakdowns;
  const populationTrend = await fetchPopulationTrend(exact,now,archive);
  const projections = await fetchProjections(now);
  extendRegionalProjections(regionalTimeline,projections,regionalDetails,now);
  const data = buildDataset(population, vital, 'official', now, { regionalTimeline, regionalDetails, eventBreakdowns, breakdown, bases, migration, japaneseBases, officialRegions, nationalities, distribution, archive, populationTrend, projections, nationalEvents, migrationsByGroup: {total:migration,japanese:japaneseMigration,foreign:foreignMigration} });
  console.log(await publishDataset(data) ? 'すべての検証に成功し、JSONを更新しました。' : '統計・推計モデルの変更はありません。');
} catch (error) {
  // Only local controlled errors are printed. Zod diagnostics can include source input; avoid dumping them.
  const message = error instanceof Error ? error.message : 'データ更新に失敗しました';
  const secret = process.env.ESTAT_APP_ID;
  console.error(secret ? message.split(secret).join('[REDACTED]') : message);
  process.exitCode = 1;
}
