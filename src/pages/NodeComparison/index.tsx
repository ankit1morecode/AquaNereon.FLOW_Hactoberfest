import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useQuery } from '../../services/ApiProvider';
import { Empty, ErrorNote, Loading, Panel, StateBadge, relativeTime } from '../../components/ui';
import { comparisonIds, designUtilization, signedDifference } from './comparison';
import { ComparisonTrends } from './ComparisonTrends';
import { SavedComparisonSets } from './SavedComparisonSets';
import { ComparisonCsvExport } from './ComparisonCsvExport';
import '../NodeDirectory/nodes.css';

export function NodeComparison() {
  const [params, setParams] = useSearchParams();
  const client = useApi();
  const nodes = useQuery((c) => c.getNodes(), []);
  const ids = comparisonIds(params);
  const committedIds = JSON.stringify(ids);
  const previousIds = useRef(committedIds);
  const pendingIds = useRef(ids);
  if (previousIds.current !== committedIds) { previousIds.current = committedIds; pendingIds.current = ids; }
  const applyIds = (nextIds: string[]) => {
    const unique = [...new Set(nextIds)].filter(Boolean).slice(0, 3);
    pendingIds.current = unique;
    const next = new URLSearchParams();
    for (const value of unique) next.append('node', value);
    setParams(next);
  };
  const choose = (index: number, id: string) => {
    const nextIds = [...pendingIds.current];
    if (id) nextIds[index] = id; else nextIds.splice(index, 1);
    applyIds(nextIds);
  };
  if (nodes.error) return <ErrorNote error={nodes.error} />;
  if (!nodes.data) return <Loading what="node comparison" />;
  const selected = ids.map((id) => nodes.data!.find((node) => node.node_id === id)).filter((node) => node !== undefined);
  const unknown = ids.filter((id) => !nodes.data!.some((node) => node.node_id === id));
  const reference = selected[0];
  return <div className="page node-comparison">
    <Panel title="Compare nodes" subtitle="Live readings, with the first node as the reference" actions={<Link className="btn" to="/nodes">Choose from directory</Link>}>
      <div className="node-tools">
        {[0, 1, 2].map((index) => <label key={index}>Node {index + 1}{index === 0 ? ' (reference)' : ''}
          <select value={ids[index] ?? ''} onChange={(event) => choose(index, event.target.value)}>
            <option value="">Select a node</option>
            {unknown.includes(ids[index]) && <option value={ids[index]}>{ids[index]} (unavailable)</option>}
            {nodes.data!.map((node) => <option key={node.node_id} value={node.node_id} disabled={ids.includes(node.node_id) && ids[index] !== node.node_id}>{node.node_id} · {node.location.label}</option>)}
          </select>
        </label>)}
        <button className="btn" type="button" onClick={() => applyIds([])}>Clear comparison</button>
      </div>
      <SavedComparisonSets ids={ids} availableIds={selected.map((node) => node.node_id)} onLoad={applyIds} />
      <ComparisonCsvExport nodes={selected} source={client} error={nodes.error} />
      <p className="node-results">The address contains your selected nodes; copy it to share this comparison. Readings continue to update.</p>
      {unknown.length > 0 && <p className="node-results" role="status">Unavailable nodes: {unknown.join(', ')}. Select a replacement above.</p>}
      {selected.length < 2 && <Empty>Select at least two nodes to compare. You can compare up to three.</Empty>}
      {reference && <div className="node-table-wrap"><table className="node-table node-comparison-table">
        <caption className="node-results">{selected.length} selected · differences are relative to {reference.node_id}</caption>
        <thead><tr><th scope="col">Metric</th>{selected.map((node) => <th key={node.node_id} scope="col"><Link to={`/nodes/${encodeURIComponent(node.node_id)}`}>{node.node_id}</Link><small>{node.location.label}</small></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">State</th>{selected.map((node) => <td key={node.node_id}><StateBadge state={node.state} size="sm" /></td>)}</tr>
          <tr><th scope="row">Health</th>{selected.map((node) => <td key={node.node_id}>{node.health}</td>)}</tr>
          <tr><th scope="row">Outlet flow (L/s)</th>{selected.map((node) => <td key={node.node_id}>{node.flow_lps.toFixed(1)}</td>)}</tr>
          <tr><th scope="row">Flow difference (L/s)</th>{selected.map((node, index) => <td key={node.node_id}>{index === 0 ? 'Reference' : signedDifference(node.flow_lps, reference.flow_lps)}</td>)}</tr>
          <tr><th scope="row">Design flow (L/s)</th>{selected.map((node) => <td key={node.node_id}>{node.nominal_flow_lps.toFixed(1)}</td>)}</tr>
          <tr><th scope="row">Design utilization</th>{selected.map((node) => { const utilization = designUtilization(node.flow_lps, node.nominal_flow_lps); return <td key={node.node_id}>{utilization === null ? 'Unavailable' : `${utilization.toFixed(1)}%`}</td>; })}</tr>
          <tr><th scope="row">Anomaly score</th>{selected.map((node) => <td key={node.node_id}>{node.anomaly_score.toFixed(3)}</td>)}</tr>
          <tr><th scope="row">Anomaly difference</th>{selected.map((node, index) => <td key={node.node_id}>{index === 0 ? 'Reference' : signedDifference(node.anomaly_score, reference.anomaly_score, 3)}</td>)}</tr>
          <tr><th scope="row">Sampling mode</th>{selected.map((node) => <td key={node.node_id}>{node.sampling_mode.replace(/_/g, ' ').toLowerCase()}</td>)}</tr>
          <tr><th scope="row">Last seen</th>{selected.map((node) => <td key={node.node_id}>{relativeTime(node.last_seen)}</td>)}</tr>
        </tbody>
      </table></div>}
    </Panel>
    <ComparisonTrends ids={selected.map((node) => node.node_id)} />
  </div>;
}
