import type { DashboardData } from '../types/statistics';
import { PopulationExplorer } from '../components/PopulationExplorer';
import { MigrationSection } from '../components/MigrationSection';
import { VitalSection } from '../components/VitalSection';
import { RegionSelector } from '../components/RegionSelector';
export function Home({ data, now }: { data: DashboardData; now: number }) {
  return <><PopulationExplorer national={data.national} now={now} demo={data.manifest.mode === 'fixture'}/><VitalSection vital={data.national.vital} now={now} name="全国"/><MigrationSection migration={data.national.migration} now={now} name="全国"/><RegionSelector/></>;
}
