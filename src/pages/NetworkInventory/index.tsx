import { useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '../../services/ApiProvider';
import { filterPipeAssets, inventoryLength, pipeAssets, pipeSort } from '../../services/networkInventory';
import { Empty, ErrorNote, Loading, Panel } from '../../components/ui';
import type { NetworkVertex } from '../../types';
import './network-inventory.css';
import { TopologyTrace } from './TopologyTrace';

const quantity = (value: number) => Number.isFinite(value) && value >= 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : 'Not reported';
function Endpoint({ id, vertex }: { id: string; vertex: NetworkVertex | undefined }) {
  return <>{vertex?.kind === 'JUNCTION' ? <Link to={`/nodes/${encodeURIComponent(id)}`}>{id}</Link> : <span>{id}</span>}
    <small>{vertex ? `${vertex.location.label} · ${vertex.kind.toLowerCase()}` : 'Endpoint is absent from loaded vertices'}</small></>;
}

export function NetworkInventory() {
  const network = useQuery((client) => client.getNetwork(), []);
  const [params, setParams] = useSearchParams();
  const committed = params.toString();
  const previous = useRef(committed);
  const pending = useRef(new URLSearchParams(params));
  if (previous.current !== committed) { previous.current = committed; pending.current = new URLSearchParams(params); }
  const updateMany = (changes: Record<string, string>) => {
    const next = new URLSearchParams(pending.current);
    for (const [key, value] of Object.entries(changes)) {
      if (value && !(key === 'sort' && value === 'id') && !(key === 'direction' && value === 'downstream')) next.set(key, value); else next.delete(key);
    }
    pending.current = next;
    setParams(next, { replace: true });
  };
  const update = (key: string, value: string) => updateMany({ [key]: value });
  const assets = useMemo(() => network.data ? pipeAssets(network.data) : [], [network.data]);
  const filtered = useMemo(() => filterPipeAssets(assets, params), [assets, params]);
  const length = inventoryLength(filtered);
  if (network.error && !network.data) return <ErrorNote error={network.error} />;
  if (!network.data) return <Loading what="pipe inventory" />;
  const graph = network.data;
  const otherAssets = graph.vertices.filter((vertex) => vertex.kind !== 'JUNCTION');
  return <div className="page network-inventory">
    <Panel title="Pipe asset inventory" subtitle="Physical properties and endpoints from the loaded network graph">
      {network.error && <ErrorNote error={network.error} />}
      <div className="network-tools">
        <label>Search pipes<input type="search" value={params.get('q') ?? ''} maxLength={200} placeholder="Pipe, endpoint, street or zone" onChange={(event) => update('q', event.target.value)} /></label>
        <label>Pipe zone<select value={params.get('zone') ?? ''} onChange={(event) => update('zone', event.target.value)}>
          <option value="">All zones</option>
          {params.get('zone') && !graph.zones.some((zone) => zone.zone_id === params.get('zone')) && <option value={params.get('zone')!}>{params.get('zone')} (unavailable)</option>}
          {graph.zones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}</option>)}
        </select></label>
        <label>Sort pipes<select value={pipeSort(params.get('sort'))} onChange={(event) => update('sort', event.target.value)}>
          <option value="id">Pipe ID</option><option value="length">Longest first</option><option value="diameter">Largest diameter</option><option value="flow">Highest design flow</option>
        </select></label>
        <button type="button" className="btn" onClick={() => updateMany({ q: '', zone: '', sort: '' })}>Clear pipe filters</button>
      </div>
      <p className="network-note" role="status">{filtered.length} of {assets.length} loaded pipes · known length {quantity(length.metres)} m across {length.measured} matching pipes.</p>
      <p className="network-note">Zone filters match either endpoint, including pipes that cross zones. Design flow and pressure are asset specifications.</p>
      {filtered.length === 0 ? <Empty>{assets.length ? 'No pipes match these filters.' : 'No pipes are available in the loaded network.'}</Empty> :
        <div className="network-table-wrap"><table className="network-table">
          <thead><tr><th scope="col">Pipe</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Endpoint zones</th><th scope="col">Length (m)</th><th scope="col">Diameter (mm)</th><th scope="col">Design flow (L/s)</th><th scope="col">Design pressure (kPa)</th></tr></thead>
          <tbody>{filtered.map(({ pipe, from, to, zoneIds }) => <tr key={pipe.pipe_id}>
            <th scope="row">{pipe.pipe_id}</th><td><Endpoint id={pipe.from} vertex={from} /></td><td><Endpoint id={pipe.to} vertex={to} /></td>
            <td>{zoneIds.length ? zoneIds.map((id) => <div key={id}>{graph.zones.some((zone) => zone.zone_id === id) ? <Link to={`/zones/${encodeURIComponent(id)}`}>{graph.zones.find((zone) => zone.zone_id === id)?.name}</Link> : id}</div>) : 'Not reported'}</td>
            <td>{quantity(pipe.length_m)}</td><td>{quantity(pipe.diameter_mm)}</td><td>{quantity(pipe.nominal_flow_lps)}</td><td>{quantity(pipe.nominal_pressure_kpa)}</td>
          </tr>)}</tbody>
        </table></div>}
    </Panel>
    <TopologyTrace network={graph} params={params} update={updateMany} />
    <Panel title="Other network assets" subtitle="Loaded reservoirs, pumps, valves and demand assets">
      {otherAssets.length ? <ul className="network-assets">{otherAssets.map((vertex) => <li key={vertex.id}>
        <strong>{vertex.id}</strong><span>{vertex.location.label}</span><span>{vertex.kind.toLowerCase()}</span><small>{vertex.location.address ?? 'No address reported'}</small>
      </li>)}</ul> : <Empty>No additional assets are present in the loaded network.</Empty>}
    </Panel>
  </div>;
}
