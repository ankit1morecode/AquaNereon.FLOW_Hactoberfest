import type { Recommendation, WaterEvent } from '../types';
import type { ReportFilters } from './reportFilters';

interface IncidentHandoff {
  events: WaterEvent[];
  recommendations: Recommendation[];
  source: { mode: 'REAL' | 'SIMULATION'; label: string };
  filters: ReportFilters;
  loadedCount: number;
  availableCount: number;
  generatedAt?: string;
  timeZone?: string;
}

/** Keep API-provided labels as visible text, even in another Markdown renderer. */
export function handoffText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\')
    .replace(/([`*_{}\[\]()#+.!|~\-])/g, '\\$1');
}

export function buildIncidentHandoff({
  events, recommendations, source, filters, loadedCount, availableCount,
  generatedAt = new Date().toISOString(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: IncidentHandoff): string {
  const text = handoffText;
  const lines = [
    '# AquaNereon.FLOW incident handoff', '',
    `Generated: ${text(generatedAt)}`,
    `Data source: **${source.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'}** — ${text(source.label)}`,
    `Event dates: ${text(filters.startDate || 'any start')} through ${text(filters.endDate || 'any end')} (inclusive local dates; ${text(timeZone)})`,
    `Status scope: ${filters.status === 'session' ? 'all loaded statuses' : filters.status}`,
    `Selected incidents: ${events.length}. Loaded events: ${loadedCount} of ${availableCount} available.`,
    'Scope: this handoff covers the loaded event subset only; it is not an exhaustive incident archive.',
    'Event timestamps below are preserved with their original timezone or UTC offset.', '',
  ];
  if (events.length === 0) lines.push('No incidents match the selected report scope.', '');
  const severityOrder = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const ordered = [...events].sort((a, b) =>
    severityOrder.indexOf(b.severity) - severityOrder.indexOf(a.severity) ||
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  for (const event of ordered) {
    lines.push(
      `## ${text(event.event_id)} — ${text(event.event_type)}`, '',
      `- Node: ${text(event.node_id)}; zone: ${text(event.zone_id)}`,
      `- Raised: ${text(event.timestamp)}`,
      `- Severity: ${text(event.severity)}; status: ${text(event.status)}`,
      `- State transition: ${text(event.state_transition.from)} → ${text(event.state_transition.to)}`,
      `- Anomaly score: ${event.anomaly_score.toFixed(3)}`,
      `- Network context: ${text(event.network_context.propagation)}`,
      `- Data quality: completeness ${(event.data_quality.completeness * 100).toFixed(0)}%; confidence ${(event.data_quality.confidence * 100).toFixed(0)}%; stale: ${event.data_quality.stale ? 'yes' : 'no'}`,
      `- Suspect channels: ${event.data_quality.suspect_channels.join(', ') || 'none flagged'}`,
      `- Intervention reference: ${text(event.intervention_id ?? 'none recorded')}`,
      `- Verification reference: ${text(event.verification_id ?? 'none recorded')}`,
    );
    if (event.suspected_origin) {
      lines.push(`- Suspected origin: ${text(event.suspected_origin.description)} (confidence ${(event.suspected_origin.confidence * 100).toFixed(0)}%)`);
    }
    for (const direction of ['upstream_states', 'downstream_states'] as const) {
      const neighbours = event.network_context[direction];
      if (neighbours.length) lines.push(`- ${direction === 'upstream_states' ? 'Upstream' : 'Downstream'}: ${neighbours.map((node) => `${text(node.node_id)} ${text(node.state)}`).join('; ')}`);
    }
    lines.push('', '### Evidence', '');
    if (!event.evidence.length) lines.push('No evidence items recorded.');
    for (const item of event.evidence) {
      lines.push(`- ${text(item.label)}: ${text(item.value)} (weight ${item.weight.toFixed(2)})${item.detail ? ` — ${text(item.detail)}` : ''}`);
    }
    if (event.model_outputs.length) lines.push('', '### Model assessments', '');
    for (const model of event.model_outputs) {
      lines.push(`- ${text(model.model_id)} ${text(model.model_version)}: ${text(model.prediction)} (score ${model.score.toFixed(3)}; confidence ${(model.confidence * 100).toFixed(0)}%). ${model.explanation.map(text).join(' ')}`);
    }
    lines.push('', '### Actions and verification', '');
    const linked = recommendations.filter((recommendation) => recommendation.event_id === event.event_id);
    if (event.recommended_action) {
      lines.push(`- Event recommendation (P${event.recommended_action.priority}): ${text(event.recommended_action.action)} — ${text(event.recommended_action.rationale)}`);
    }
    if (!linked.length) lines.push('No separate recommendation or verification plan is linked to this incident.');
    for (const recommendation of linked) {
      lines.push(
        `- ${text(recommendation.recommendation_id)} (P${recommendation.priority}; ${text(recommendation.status)}; issued ${text(recommendation.issued_at)}): ${text(recommendation.action)}`,
        `  Rationale: ${text(recommendation.rationale)}`,
        `  Expected effect: ${text(recommendation.expected_effect)}`,
        `  Verification plan: ${text(recommendation.verification)}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
