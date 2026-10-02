import type { National, PopulationGroup, GroupedEvents } from '../types/statistics';
export const GROUP_LABELS = { total: '総人口', japanese: '日本人', foreign: '外国人' };
export function nationalIndicators(n: National, group: PopulationGroup): GroupedEvents[PopulationGroup] {
  if (n.eventsByGroup) return group === 'total' ? {...n.eventsByGroup.total, marriage:n.eventsByGroup.japanese.marriage, divorce:n.eventsByGroup.japanese.divorce} : n.eventsByGroup[group];
  const result: GroupedEvents[PopulationGroup] = {};
  // Older JSON contains Japanese vital statistics. Its register-based migration
  // is not the population-estimate entry/exit series; leave national movement unavailable.
  if (group === 'japanese') for (const kind of ['birth','death','marriage','divorce'] as const) result[kind] = {source:n.vital.source,months:Object.fromEntries(Object.entries(n.vital.months).map(([m,v])=>[m,v[kind]])),yearToDate:Object.fromEntries(Object.entries(n.vital.yearToDate ?? {}).map(([m,v])=>[m,v[kind]]))};
  if (group === 'total') for (const kind of ['marriage','divorce'] as const) result[kind] = {source:n.vital.source,months:Object.fromEntries(Object.entries(n.vital.months).map(([m,v])=>[m,v[kind]])),yearToDate:Object.fromEntries(Object.entries(n.vital.yearToDate ?? {}).map(([m,v])=>[m,v[kind]]))};

  return result;
}
