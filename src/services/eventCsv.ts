import type { WaterEvent } from '../types';

/** Quote every cell and neutralize spreadsheet formulas, including whitespace-prefixed ones. */
export function eventCsvCell(value: string | number | undefined): string {
  const text = value === undefined || (typeof value === 'number' && !Number.isFinite(value)) ? '' : String(value);
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Export exactly the provided query results in their visible ordering. */
export function eventsToCsv(events: WaterEvent[]): string {
  const headers = ['event_id', 'event_type', 'node_id', 'zone_id', 'timestamp_utc', 'severity', 'status',
    'anomaly_score', 'previous_state', 'current_state', 'confidence', 'completeness', 'suspected_origin',
    'recommended_action', 'evidence', 'intervention_id', 'verification_id'];
  const rows = events.map((event) => [event.event_id, event.event_type, event.node_id, event.zone_id,
    event.timestamp, event.severity, event.status, event.anomaly_score, event.state_transition.from,
    event.state_transition.to, event.data_quality.confidence, event.data_quality.completeness,
    event.suspected_origin?.description, event.recommended_action?.action,
    event.evidence.map((item) => `${item.label}: ${item.value}`).join(' | '),
    event.intervention_id, event.verification_id]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(eventCsvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadEventsCsv(events: WaterEvent[]): void {
  const blob = new Blob([eventsToCsv(events)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aquanereon-events-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
