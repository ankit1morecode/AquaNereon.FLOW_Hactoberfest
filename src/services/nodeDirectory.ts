import type { NodeSummary } from '../types';

export type NodeSort = 'id' | 'anomaly' | 'flow';

export function filterNodes(nodes: NodeSummary[], params: URLSearchParams): NodeSummary[] {
  const query = (params.get('q') ?? '').trim().toLocaleLowerCase();
  const zone = params.get('zone');
  const state = params.get('state');
  const sort = params.get('sort');
  return nodes.filter((node) =>
    (!query || [node.node_id, node.location.label, node.location.address ?? '', node.zone_id]
      .some((value) => value.toLocaleLowerCase().includes(query))) &&
    (!zone || node.zone_id === zone) && (!state || node.state === state),
  ).sort((a, b) => {
    const delta = sort === 'anomaly' ? b.anomaly_score - a.anomaly_score
      : sort === 'flow' ? b.flow_lps - a.flow_lps : 0;
    return delta || a.node_id.localeCompare(b.node_id);
  });
}
