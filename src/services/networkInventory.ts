import type { NetworkEdge, NetworkGraph, NetworkVertex } from '../types';

export const PIPE_SORTS = ['id', 'length', 'diameter', 'flow'] as const;
export type PipeSort = typeof PIPE_SORTS[number];
export interface PipeAsset {
  pipe: NetworkEdge;
  from: NetworkVertex | undefined;
  to: NetworkVertex | undefined;
  zoneIds: string[];
  zoneNames: string[];
}
export function pipeSort(value: string | null): PipeSort {
  return PIPE_SORTS.includes(value as PipeSort) ? value as PipeSort : 'id';
}
export function pipeAssets(network: NetworkGraph): PipeAsset[] {
  const vertices = new Map(network.vertices.map((vertex) => [vertex.id, vertex]));
  const zones = new Map(network.zones.map((zone) => [zone.zone_id, zone.name]));
  return network.edges.map((pipe) => {
    const from = vertices.get(pipe.from);
    const to = vertices.get(pipe.to);
    const zoneIds = [...new Set([from?.zone_id, to?.zone_id].filter((id): id is string => Boolean(id)))];
    return { pipe, from, to, zoneIds, zoneNames: zoneIds.map((id) => zones.get(id) ?? id) };
  });
}
export function filterPipeAssets(assets: PipeAsset[], params: URLSearchParams): PipeAsset[] {
  const query = (params.get('q') ?? '').trim().toLocaleLowerCase().slice(0, 200);
  const zone = params.get('zone') ?? '';
  const sort = pipeSort(params.get('sort'));
  const metric = (asset: PipeAsset) => sort === 'length' ? asset.pipe.length_m : sort === 'diameter' ? asset.pipe.diameter_mm : asset.pipe.nominal_flow_lps;
  return assets.filter((asset) => {
    if (zone && !asset.zoneIds.includes(zone)) return false;
    const fields = [asset.pipe.pipe_id, asset.pipe.from, asset.pipe.to, ...asset.zoneIds, ...asset.zoneNames,
      asset.from?.location.label, asset.from?.location.address, asset.to?.location.label, asset.to?.location.address];
    return !query || fields.join(' ').toLocaleLowerCase().includes(query);
  }).sort((a, b) => {
    if (sort !== 'id') {
      const first = metric(a); const second = metric(b);
      const validFirst = Number.isFinite(first) && first >= 0;
      const validSecond = Number.isFinite(second) && second >= 0;
      if (validFirst !== validSecond) return validFirst ? -1 : 1;
      if (validFirst && first !== second) return second - first;
    }
    return a.pipe.pipe_id.localeCompare(b.pipe.pipe_id);
  });
}
export function inventoryLength(assets: PipeAsset[]): { metres: number; measured: number } {
  const known = assets.filter((asset) => Number.isFinite(asset.pipe.length_m) && asset.pipe.length_m >= 0);
  return { metres: known.reduce((sum, asset) => sum + asset.pipe.length_m, 0), measured: known.length };
}
