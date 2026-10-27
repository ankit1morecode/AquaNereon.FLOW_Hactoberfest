import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '../../services/ApiProvider';
import { filterZones, zoneMargin, zoneSort } from '../../services/zoneOverview';
import { Empty, ErrorNote, Loading, Panel, StateBadge } from '../../components/ui';
import './zones.css';

const number = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable';
const percent = (value: number) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unavailable';

export function ZoneOverview() {
  const zones = useQuery((client) => client.getZones(), []);
  const [params, setParams] = useSearchParams();
  const committed = params.toString();
  const previous = useRef(committed);
  const pending = useRef(new URLSearchParams(params));
  if (previous.current !== committed) {
    previous.current = committed;
    pending.current = new URLSearchParams(params);
  }
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(pending.current);
    if (value && !(key === 'sort' && value === 'name')) next.set(key, value); else next.delete(key);
    pending.current = next;
    setParams(next, { replace: true });
  };
  if (zones.error) return <ErrorNote error={zones.error} />;
  if (!zones.data) return <Loading what="zones" />;
  const filtered = filterZones(zones.data, params);
  return <div className="page zone-overview">
    <Panel title="Zone overview" subtitle="Compare current supply, demand and reported shortage across every loaded zone">
      <div className="zone-overview-tools">
        <label>Search zones<input type="search" value={params.get('q') ?? ''} maxLength={200}
          placeholder="Zone name or ID" onChange={(event) => update('q', event.target.value)} /></label>
        <label>Sort zones<select value={zoneSort(params.get('sort'))} onChange={(event) => update('sort', event.target.value)}>
          <option value="name">Zone name</option><option value="demand">Highest demand</option>
          <option value="shortage">Highest shortage risk</option><option value="loss">Highest inferred loss</option>
          <option value="margin">Largest supply margin</option>
        </select></label>
        <button type="button" className="btn" onClick={() => { const next = new URLSearchParams(); pending.current = next; setParams(next); }}>Clear filters</button>
      </div>
      <p className="zone-overview-note" role="status">{filtered.length} of {zones.data.length} zones · supply margin = reported supply − demand (L/s)</p>
      {filtered.length === 0 ? <Empty>{zones.data.length ? 'No zones match this search.' : 'No zones are available.'}</Empty> :
        <div className="zone-overview-table-wrap"><table className="zone-overview-table">
          <thead><tr><th scope="col">Zone</th><th scope="col">Population</th><th scope="col">Supply (L/s)</th><th scope="col">Demand (L/s)</th><th scope="col">Margin (L/s)</th><th scope="col">Inferred loss</th><th scope="col">Shortage risk</th><th scope="col">Worst state</th><th scope="col">Explore</th></tr></thead>
          <tbody>{filtered.map((zone) => {
            const margin = zoneMargin(zone);
            return <tr key={zone.zone_id}>
              <th scope="row"><Link to={`/zones/${encodeURIComponent(zone.zone_id)}`}>{zone.name}</Link><small>{zone.zone_id}</small></th>
              <td>{Number.isFinite(zone.population) ? zone.population.toLocaleString() : 'Unavailable'}</td>
              <td>{number(zone.supply_lps)}</td><td>{number(zone.demand_lps)}</td>
              <td className={margin !== null && margin < 0 ? 'zone-margin-deficit' : ''}>{margin === null ? 'Unavailable' : `${margin > 0 ? '+' : ''}${number(margin)}`}</td>
              <td>{percent(zone.loss_fraction)}</td><td>{percent(zone.shortage_risk)}</td><td><StateBadge state={zone.worst_state} size="sm" /></td>
              <td><div className="zone-overview-links"><Link to={`/nodes?zone=${encodeURIComponent(zone.zone_id)}`}>Nodes ({zone.node_ids.length})</Link><Link to={`/events?zone=${encodeURIComponent(zone.zone_id)}`}>Events ({zone.open_events} open)</Link></div></td>
            </tr>;
          })}</tbody>
        </table></div>}
      <p className="zone-overview-note">Inferred losses and shortage risk come from the current API assessment. The supply margin is a direct comparison of reported values; it does not adjust for losses.</p>
    </Panel>
  </div>;
}
