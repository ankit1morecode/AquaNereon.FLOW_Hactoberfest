import type { NodeSummary } from '../types';
import { designUtilization } from '../pages/NodeComparison/comparison';

export interface ComparisonSource { mode: 'REAL' | 'SIMULATION'; label: string }
export function comparisonCsvCell(value: string | number | null): string {
  let text = value === null || (typeof value === 'number' && !Number.isFinite(value)) ? '' : String(value);
  if (typeof value === 'string' && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function utc(timestamp: string): string {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? new Date(value).toISOString() : '';
}

/** A point-in-time export of the selected loaded rows, with their first row as reference. */
export function comparisonToCsv(nodes: NodeSummary[], source: ComparisonSource, capturedAt = new Date().toISOString()): string {
  const selected = nodes.slice(0, 3);
  const reference = selected[0];
  const headers = ['captured_at_utc', 'source_mode', 'source_label', 'reference_node_id', 'node_id', 'location', 'zone_id',
    'state', 'health', 'flow_lps', 'flow_difference_lps', 'design_flow_lps', 'design_utilization_pct',
    'anomaly_score', 'anomaly_difference', 'sampling_mode', 'last_seen_utc', 'last_seen_original'];
  const rows = selected.map((node) => [utc(capturedAt), source.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE', source.label,
    reference.node_id, node.node_id, node.location.label, node.zone_id, node.state, node.health,
    node.flow_lps, node.flow_lps - reference.flow_lps, node.nominal_flow_lps,
    designUtilization(node.flow_lps, node.nominal_flow_lps), node.anomaly_score,
    node.anomaly_score - reference.anomaly_score, node.sampling_mode, utc(node.last_seen), node.last_seen]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(comparisonCsvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadComparisonCsv(nodes: NodeSummary[], source: ComparisonSource): void {
  const capturedAt = new Date().toISOString();
  const blob = new Blob([comparisonToCsv(nodes, source, capturedAt)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aquanereon-comparison-${capturedAt.slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
