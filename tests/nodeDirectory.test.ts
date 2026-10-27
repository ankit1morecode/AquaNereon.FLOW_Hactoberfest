import { describe, expect, it } from 'vitest';
import { filterNodes } from '../src/services/nodeDirectory';
import { PlatformSimulator } from '../src/services/platformSimulator';
import { SimulatedApiClient } from '../src/services/simulatedClient';

const nodes = await new SimulatedApiClient(new PlatformSimulator()).getNodes();

describe('node directory queries', () => {
  it('searches streets and labels case-insensitively', () => {
    const node = nodes.find((item) => item.location.address)!;
    const result = filterNodes(nodes, new URLSearchParams({ q: node.location.address!.toUpperCase() }));
    expect(result.map((item) => item.node_id)).toContain(node.node_id);
  });
  it('combines zone, state and text while leaving the source order intact', () => {
    const before = nodes.map((item) => item.node_id);
    const node = nodes[0];
    const result = filterNodes(nodes, new URLSearchParams({ q: node.node_id, zone: node.zone_id, state: node.state }));
    expect(result.map((item) => item.node_id)).toEqual([node.node_id]);
    expect(filterNodes(nodes, new URLSearchParams({ q: node.node_id, zone: 'missing' }))).toEqual([]);
    expect(nodes.map((item) => item.node_id)).toEqual(before);
  });
  it('orders high anomalies and flows first with deterministic ID ties', () => {
    const ranked = filterNodes(nodes, new URLSearchParams({ sort: 'anomaly' }));
    expect(ranked.every((item, index) => index === 0 || ranked[index - 1].anomaly_score >= item.anomaly_score)).toBe(true);
    const flow = filterNodes(nodes, new URLSearchParams({ sort: 'flow' }));
    expect(flow.every((item, index) => index === 0 || flow[index - 1].flow_lps >= item.flow_lps)).toBe(true);
  });
});
