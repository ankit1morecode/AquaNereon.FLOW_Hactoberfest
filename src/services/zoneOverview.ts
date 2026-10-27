import type { ZoneSummary } from '../types';

export const ZONE_SORTS = ['name', 'demand', 'shortage', 'loss', 'margin'] as const;
export type ZoneSort = typeof ZONE_SORTS[number];
export function zoneSort(value: string | null): ZoneSort {
  return ZONE_SORTS.includes(value as ZoneSort) ? value as ZoneSort : 'name';
}
export function zoneMargin(zone: Pick<ZoneSummary, 'supply_lps' | 'demand_lps'>): number | null {
  return Number.isFinite(zone.supply_lps) && Number.isFinite(zone.demand_lps)
    ? zone.supply_lps - zone.demand_lps : null;
}
export function filterZones(zones: ZoneSummary[], params: URLSearchParams): ZoneSummary[] {
  const query = (params.get('q') ?? '').trim().toLocaleLowerCase();
  const sort = zoneSort(params.get('sort'));
  const finite = (value: number) => Number.isFinite(value) ? value : -Infinity;
  return zones.filter((zone) => `${zone.name} ${zone.zone_id}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const difference = sort === 'demand' ? finite(b.demand_lps) - finite(a.demand_lps)
        : sort === 'shortage' ? finite(b.shortage_risk) - finite(a.shortage_risk)
          : sort === 'loss' ? finite(b.loss_fraction) - finite(a.loss_fraction)
            : sort === 'margin' ? finite(zoneMargin(b) ?? NaN) - finite(zoneMargin(a) ?? NaN) : 0;
      return (Number.isNaN(difference) ? 0 : difference) || a.name.localeCompare(b.name) || a.zone_id.localeCompare(b.zone_id);
    });
}
