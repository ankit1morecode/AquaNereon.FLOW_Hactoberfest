import type { TelemetryFrame } from '../types';
import type { TelemetryRange } from './telemetryWindow';

export interface TelemetryExportScope {
  nodeId: string;
  sourceMode: 'REAL' | 'SIMULATION';
  range: TelemetryRange;
  capturedAt: string | null;
}

export function telemetryCsvCell(value: string | number | boolean | undefined): string {
  const text = value === undefined || (typeof value === 'number' && !Number.isFinite(value)) ? '' : String(value);
  const safe = typeof value === 'string' && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function utcTimestamp(timestamp: string | null): string {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return '';
  return new Date(timestamp).toISOString();
}

/** No re-query: these are the displayed range or frozen snapshot supplied by the page. */
export function telemetryToCsv(frames: TelemetryFrame[], scope: TelemetryExportScope): string {
  const headers = ['node_id', 'source_mode', 'trace_mode', 'telemetry_window', 'captured_at_utc',
    'timestamp_utc', 'timestamp_original', 'flow_a_lps', 'flow_b_lps', 'flow_out_lps',
    'pressure_a_kpa', 'pressure_b_kpa', 'pressure_out_kpa', 'acoustic_rms', 'conductivity_us_cm',
    'turbidity_ntu', 'temperature_c', 'completeness', 'confidence', 'stale', 'suspect_channels',
    ...Array.from({ length: 16 }, (_, index) => `ring_channel_${String(index + 1).padStart(2, '0')}`)];
  const rows = frames.filter((frame) => frame.node_id === scope.nodeId).map((frame) => [
    frame.node_id, scope.sourceMode === 'SIMULATION' ? 'SIMULATION' : 'LIVE', scope.capturedAt ? 'frozen' : 'live',
    scope.range === 'all' ? 'all_loaded' : `latest_${scope.range}_seconds`, utcTimestamp(scope.capturedAt),
    utcTimestamp(frame.timestamp), frame.timestamp, frame.flow.a, frame.flow.b, frame.flow.out,
    frame.pressure.a, frame.pressure.b, frame.pressure.out, frame.acoustic_rms, frame.conductivity_us_cm,
    frame.turbidity_ntu, frame.temperature_c, frame.data_quality.completeness, frame.data_quality.confidence,
    frame.data_quality.stale, frame.data_quality.suspect_channels.join(';'),
    ...Array.from({ length: 16 }, (_, index) => frame.circumferential_channels[index]),
  ]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(telemetryCsvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadTelemetryCsv(frames: TelemetryFrame[], scope: TelemetryExportScope): void {
  const blob = new Blob([telemetryToCsv(frames, scope)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeNode = scope.nodeId.replace(/[^a-zA-Z0-9._-]/g, '_');
  anchor.download = `aquanereon-telemetry-${safeNode}-${scope.capturedAt ? 'frozen' : 'live'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
