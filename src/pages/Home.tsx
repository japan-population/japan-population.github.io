import type { DashboardData } from '../types/statistics';
import { PopulationCounter } from '../components/PopulationCounter';
import { VitalSection } from '../components/VitalSection';
import { RegionSelector } from '../components/RegionSelector';
export function Home({ data, now }: { data: DashboardData; now: number }) {
  return <><PopulationCounter population={data.national.population} now={now} demo={data.manifest.mode === 'fixture'}/><VitalSection vital={data.national.vital} now={now} name="全国"/><RegionSelector/></>;
}
