import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { NetworkMap } from '../../components/NetworkMap';
import { Empty, Panel } from '../../components/ui';
import { useQuery } from '../../services/ApiProvider';
import { mappableTrace, traceDirection, traceTopology } from '../../services/topologyTrace';
import type { NetworkGraph } from '../../types';

export function TopologyTrace({ network, params, update }: {
  network: NetworkGraph; params: URLSearchParams; update: (changes: Record<string, string>) => void;
}) {
  const nodes = useQuery((client) => client.getNodes(), []);
  const selected = params.get('trace') ?? '';
  const direction = traceDirection(params.get('direction'));
  const trace = useMemo(() => traceTopology(network, selected, direction), [network, selected, direction]);
  const mapNetwork = useMemo(() => mappableTrace(trace.network), [trace.network]);
  const ids = useMemo(() => new Set(trace.network.vertices.map((vertex) => vertex.id)), [trace.network]);
  return <Panel title="Topology trace" subtitle="Explore structural upstream and downstream connections in the loaded network">
    <div className="network-tools">
      <label>Trace from asset<select value={selected} onChange={(event) => update({ trace: event.target.value })}>
        <option value="">Choose an asset</option>
        {selected && !trace.found && <option value={selected}>{selected} (unavailable)</option>}
        {network.vertices.map((vertex) => <option key={vertex.id} value={vertex.id}>{vertex.id} · {vertex.location.label} · {vertex.kind.toLowerCase()}</option>)}
      </select></label>
      <label>Trace direction<select value={direction} onChange={(event) => update({ direction: event.target.value })}>
        <option value="downstream">Downstream</option><option value="upstream">Upstream</option><option value="both">Upstream and downstream</option>
      </select></label>
      <button type="button" className="btn" disabled={!selected && !params.has('direction')} onClick={() => update({ trace: '', direction: '' })}>Clear trace</button>
    </div>
    <p className="network-note">Connections follow the API pipe direction. Upstream and downstream combines two separate walks from the selected asset. This trace describes topology; it does not estimate hydraulic propagation or isolation.</p>
    {trace.omittedEdges > 0 && <p className="network-note" role="status">{trace.omittedEdges} loaded pipes have missing endpoints and are excluded from tracing.</p>}
    {!selected ? <Empty>Choose an asset to inspect its connected topology.</Empty> : !trace.found ? <Empty>The selected asset is absent from the loaded network. Choose a replacement or clear the trace.</Empty> : <>
      <p className="network-note" role="status">{trace.network.vertices.length} assets and {trace.network.edges.length} pipes in the {direction === 'both' ? 'upstream and downstream' : direction} trace from {selected}.</p>
      {nodes.error && <p className="network-note" role="status">Node status refresh failed. The trace still uses the loaded network structure.</p>}
      {mapNetwork.vertices.length ? <NetworkMap network={mapNetwork} nodes={(nodes.data ?? []).filter((node) => ids.has(node.node_id))}
        selected={selected} onSelect={(nodeId) => update({ trace: nodeId })} height={330} /> : <Empty>Trace locations are unavailable. Use the asset list below.</Empty>}
      {mapNetwork.vertices.length < trace.network.vertices.length && <p className="network-note">{trace.network.vertices.length - mapNetwork.vertices.length} traced assets have unavailable locations and appear in the list only.</p>}
      <div className="network-trace-lists">
        <section aria-labelledby="trace-assets-title"><h3 id="trace-assets-title">Traced assets</h3>
          <ul>{trace.network.vertices.map((vertex) => <li key={vertex.id}>{vertex.kind === 'JUNCTION' ? <Link to={`/nodes/${encodeURIComponent(vertex.id)}`}>{vertex.id}</Link> : <strong>{vertex.id}</strong>}<span>{vertex.location.label} · {vertex.kind.toLowerCase()}</span></li>)}</ul>
        </section>
        <section aria-labelledby="trace-pipes-title"><h3 id="trace-pipes-title">Traced pipes</h3>
          {trace.network.edges.length ? <ul>{trace.network.edges.map((edge) => <li key={edge.pipe_id}><strong>{edge.pipe_id}</strong><span>{edge.from} → {edge.to}</span></li>)}</ul> : <Empty>No pipes are connected in this direction. The selected asset remains in the trace.</Empty>}
        </section>
      </div>
    </>}
  </Panel>;
}
