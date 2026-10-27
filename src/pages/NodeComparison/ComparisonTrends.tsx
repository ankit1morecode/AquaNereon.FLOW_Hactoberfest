import { useState } from 'react';
import { useApi, useQuery } from '../../services/ApiProvider';
import { comparisonTrendSeries, COMPARISON_HISTORY_LIMIT, loadComparisonHistory, type ComparisonMetric } from '../../services/comparisonTrends';
import { TimeSeriesChart } from '../../components/charts';
import { Empty, ErrorNote, Loading, Panel } from '../../components/ui';
import './comparison.css';

function LoadedTrends({ ids }: { ids: string[] }) {
  const client = useApi();
  const history = useQuery((api) => loadComparisonHistory(api, ids), [ids.join('\u0000')]);
  const [metric, setMetric] = useState<ComparisonMetric>('baseline');
  const series = comparisonTrendSeries(history.data ?? [], metric);
  const hasPoints = series.some((entry) => entry.points.length > 0);
  const label = metric === 'baseline' ? 'Baseline distance' : metric === 'flow' ? 'Mean flow' : 'Mean pressure';
  return <Panel title="Comparison trends" subtitle={`Up to ${COMPARISON_HISTORY_LIMIT} loaded signatures per node · ${client.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'}`} className="comparison-trends">
    <div className="node-tools"><label>Trend metric<select value={metric} onChange={(event) => setMetric(event.target.value as ComparisonMetric)}>
      <option value="baseline">Baseline distance</option><option value="flow">Mean flow (L/s)</option><option value="pressure">Mean pressure (kPa)</option>
    </select></label></div>
    {history.error && <ErrorNote error={history.error} />}
    {!history.data && !history.error && <Loading what="comparison history" />}
    {history.data && !hasPoints && <Empty>No usable signatures are loaded for this comparison.</Empty>}
    {hasPoints && <TimeSeriesChart series={series} height={210}
      ariaLabel={`${label} comparison by recorded timestamp`} unit={metric === 'flow' ? ' L/s' : metric === 'pressure' ? ' kPa' : undefined}
      yFormat={(value) => value.toFixed(metric === 'baseline' ? 3 : 1)}
      xFormat={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />}
    {history.data && <ul className="comparison-history-notes">{history.data.map((entry, index) => <li key={entry.nodeId}>
      <strong>{entry.nodeId}{index === 0 ? ' (reference)' : ''}</strong>: {entry.error ? `History unavailable: ${entry.error}` : `${series[index].points.length} usable ${label.toLowerCase()} samples`}
      {entry.omitted > 0 && `; ${entry.omitted} samples omitted because the node or timestamp did not match.`}
      {entry.signatures.some((signature) => signature.data_quality.stale) && '; includes samples flagged stale by the source.'}
    </li>)}</ul>}
    <p className="node-results">Each point keeps its recorded timestamp; nodes are not resampled into simultaneous readings. Times use your local clock. This comparison covers only loaded signatures.</p>
  </Panel>;
}

export function ComparisonTrends({ ids }: { ids: string[] }) {
  return ids.length >= 2 ? <LoadedTrends key={JSON.stringify(ids)} ids={ids} /> : null;
}
