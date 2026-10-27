import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '../../services/ApiProvider';
import { filterNodes } from '../../services/nodeDirectory';
import { useWatchlist } from '../../services/watchlist';
import { ALL_STATES, Empty, ErrorNote, HealthDot, Loading, Panel, StateBadge, STATE_LABEL, relativeTime } from '../../components/ui';
import './nodes.css';

export function NodeDirectory() {
  const [params, setParams] = useSearchParams();
  const watchlist = useWatchlist();
  const nodes = useQuery((c) => c.getNodes(), []);
  const zones = useQuery((c) => c.getZones(), []);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  if (nodes.error) return <ErrorNote error={nodes.error} />;
  if (!nodes.data) return <Loading what="node directory" />;
  const filtered = filterNodes(nodes.data, params).filter((node) => params.get('watchlist') !== '1' || watchlist.ids.includes(node.node_id));
  return (
    <div className="page node-directory">
      <Panel title="Node directory" subtitle="Find any junction and open its live diagnostics">
        <div className="node-tools">
          <label>Search nodes<input type="search" value={params.get('q') ?? ''} placeholder="ID, location or street" onChange={(e) => update('q', e.target.value)} /></label>
          <label>Zone<select value={params.get('zone') ?? ''} onChange={(e) => update('zone', e.target.value)}>
            <option value="">All zones</option>
            {(zones.data ?? []).map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}</option>)}
          </select></label>
          <label>State<select value={params.get('state') ?? ''} onChange={(e) => update('state', e.target.value)}>
            <option value="">All states</option>
            {ALL_STATES.map((state) => <option key={state} value={state}>{STATE_LABEL[state]}</option>)}
          </select></label>
          <label>Sort by<select value={params.get('sort') ?? 'id'} onChange={(e) => update('sort', e.target.value)}>
            <option value="id">Node ID</option><option value="anomaly">Highest anomaly</option><option value="flow">Highest flow</option>
          </select></label>
          <label className="node-check"><input type="checkbox" checked={params.get('watchlist') === '1'} onChange={(e) => update('watchlist', e.target.checked ? '1' : '')} />Watchlisted only ({watchlist.ids.length})</label>
          <button type="button" className="btn" onClick={() => setParams({})}>Clear filters</button>
        </div>
        <p className="node-results" role="status">{filtered.length} of {nodes.data.length} nodes</p>
        {!watchlist.persisted && <p className="node-results" role="status">Browser storage is unavailable. Your watchlist is kept for this session.</p>}
        {filtered.length === 0 ? <Empty>No nodes match these filters.</Empty> : <div className="node-table-wrap"><table className="node-table">
          <thead><tr><th scope="col">Watch</th><th scope="col">Node / location</th><th scope="col">Zone</th><th scope="col">State</th><th scope="col">Health</th><th scope="col">Flow (L/s)</th><th scope="col">Anomaly</th><th scope="col">Last seen</th></tr></thead>
          <tbody>{filtered.map((node) => <tr key={node.node_id}>
            <td><button type="button" className="btn node-star" aria-label={`${watchlist.ids.includes(node.node_id) ? 'Remove' : 'Add'} ${node.node_id} ${watchlist.ids.includes(node.node_id) ? 'from' : 'to'} watchlist`} aria-pressed={watchlist.ids.includes(node.node_id)} onClick={() => watchlist.toggle(node.node_id)}>{watchlist.ids.includes(node.node_id) ? '★' : '☆'}</button></td>
            <td><Link to={`/nodes/${encodeURIComponent(node.node_id)}`}>{node.node_id}</Link><small>{node.location.label}</small></td>
            <td>{zones.data?.find((zone) => zone.zone_id === node.zone_id)?.name ?? node.zone_id}</td>
            <td><StateBadge state={node.state} size="sm" /></td><td><HealthDot health={node.health} /> {node.health}</td>
            <td>{node.flow_lps.toFixed(1)}</td><td>{node.anomaly_score.toFixed(3)}</td><td>{relativeTime(node.last_seen)}</td>
          </tr>)}</tbody>
        </table></div>}
      </Panel>
    </div>
  );
}
