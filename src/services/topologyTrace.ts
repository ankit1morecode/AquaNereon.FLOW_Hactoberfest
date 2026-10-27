import type { NetworkEdge, NetworkGraph } from '../types';

export const TRACE_DIRECTIONS = ['downstream', 'upstream', 'both'] as const;
export type TraceDirection = typeof TRACE_DIRECTIONS[number];
export function traceDirection(value: string | null): TraceDirection {
  return TRACE_DIRECTIONS.includes(value as TraceDirection) ? value as TraceDirection : 'downstream';
}
export interface TopologyTraceResult { found: boolean; network: NetworkGraph; omittedEdges: number }

/** Follow declared edge direction, with separate walks for ancestors and descendants. */
export function traceTopology(network: NetworkGraph, startId: string, direction: TraceDirection): TopologyTraceResult {
  const vertices = new Map(network.vertices.map((vertex) => [vertex.id, vertex]));
  const edges = network.edges.filter((edge) => vertices.has(edge.from) && vertices.has(edge.to));
  const empty = { found: false, network: { vertices: [], edges: [], zones: [] }, omittedEdges: network.edges.length - edges.length };
  if (!vertices.has(startId)) return empty;
  const incoming = new Map<string, NetworkEdge[]>();
  const outgoing = new Map<string, NetworkEdge[]>();
  for (const edge of edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  const includedVertices = new Set([startId]);
  const includedEdges = new Set<NetworkEdge>();
  const walk = (upstream: boolean) => {
    const visited = new Set([startId]);
    const queue = [startId];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const connected = (upstream ? incoming : outgoing).get(queue[cursor]) ?? [];
      for (const edge of connected) {
        const next = upstream ? edge.from : edge.to;
        includedEdges.add(edge);
        includedVertices.add(next);
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
  };
  if (direction !== 'downstream') walk(true);
  if (direction !== 'upstream') walk(false);
  const selectedVertices = [...vertices.values()].filter((vertex) => includedVertices.has(vertex.id));
  const zoneIds = new Set(selectedVertices.map((vertex) => vertex.zone_id));
  return { found: true, omittedEdges: empty.omittedEdges, network: {
    vertices: selectedVertices, edges: edges.filter((edge) => includedEdges.has(edge)),
    zones: network.zones.filter((zone) => zoneIds.has(zone.zone_id)),
  } };
}

/** Retain structural results in the list even when coordinates cannot be mapped. */
export function mappableTrace(network: NetworkGraph): NetworkGraph {
  const vertices = network.vertices.filter((vertex) => Number.isFinite(vertex.location.lat) && Number.isFinite(vertex.location.lng)
    && Math.abs(vertex.location.lat) <= 90 && Math.abs(vertex.location.lng) <= 180);
  const ids = new Set(vertices.map((vertex) => vertex.id));
  return { ...network, vertices, edges: network.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}
