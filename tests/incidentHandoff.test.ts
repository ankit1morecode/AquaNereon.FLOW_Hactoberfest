import { describe, expect, it } from 'vitest';
import { buildIncidentHandoff, handoffText } from '../src/services/incidentHandoff';
import type { Recommendation, WaterEvent } from '../src/types';

const event: WaterEvent = {
  event_id: 'EV-1', event_type: 'LEAKAGE_SUSPECTED', node_id: 'AN-1', zone_id: 'Z-1',
  timestamp: '2026-10-27T14:10:00+05:30', severity: 'HIGH', anomaly_score: 0.8,
  state_transition: { from: 'DRIFT', to: 'DISTURBANCE' }, status: 'VERIFYING',
  evidence: [{ kind: 'SENSOR', label: 'Flow loss', value: '12 L/s', weight: 0.9, detail: 'Outlet lower than feeders.' }],
  model_outputs: [{ model_id: 'M-1', model_version: '1.0', prediction: 'leak', score: 0.85, confidence: 0.9, contributing_features: ['flow'], explanation: ['Pattern persisted.'] }],
  network_context: { upstream_states: [{ node_id: 'AN-2', state: 'STABLE' }], downstream_states: [], propagation: 'LOCAL' },
  data_quality: { completeness: 1, confidence: 0.95, stale: false, suspect_channels: [] },
  intervention_id: 'INT-1', verification_id: 'VER-1',
  recommended_action: { action: 'Inspect outlet', priority: 1, rationale: 'Persistent loss' },
};
const recommendation: Recommendation = {
  recommendation_id: 'REC-1', event_id: 'EV-1', issued_at: '2026-10-27T08:45:00Z',
  priority: 1, action: 'Inspect valve', rationale: 'Signature shifted', expected_effect: 'Flow returns',
  verification: 'Sample for 120 seconds', status: 'ACCEPTED',
};
function document(events: WaterEvent[] = [event], recommendations: Recommendation[] = [recommendation]) {
  return buildIncidentHandoff({ events, recommendations, source: { mode: 'SIMULATION', label: 'Browser simulator' },
    filters: { status: 'open', startDate: '2026-10-27', endDate: '2026-10-27' },
    loadedCount: 200, availableCount: 450, generatedAt: '2026-10-27T09:00:00Z', timeZone: 'Asia/Kolkata' });
}

describe('incident handoff export', () => {
  it('preserves operational facts, evidence, source and exact report scope', () => {
    const markdown = document();
    for (const fact of ['**SIMULATION**', 'Browser simulator', 'Asia/Kolkata', 'Selected incidents: 1',
      'Loaded events: 200 of 450', 'loaded event subset', '2026\\-10\\-27T14:10:00\\+05:30',
      'VERIFYING', 'DRIFT → DISTURBANCE', '12 L/s', 'weight 0.90', 'INT\\-1', 'VER\\-1',
      'Inspect valve', 'Sample for 120 seconds', 'Pattern persisted\\.', 'STABLE']) {
      expect(markdown).toContain(fact);
    }
  });
  it('includes only selected incidents and recommendations explicitly linked to them', () => {
    const markdown = document([event], [recommendation, { ...recommendation, event_id: 'EV-other', action: 'Unrelated action' }]);
    expect(markdown).not.toContain('Unrelated action');
    expect(markdown).toContain('Inspect outlet');
    expect(document([], [recommendation])).not.toContain('Inspect valve');
  });
  it('states missing verification and recommendations without inventing an outcome', () => {
    const markdown = document([{ ...event, verification_id: undefined, intervention_id: undefined }], []);
    expect(markdown).toContain('Verification reference: none recorded');
    expect(markdown).toContain('No separate recommendation or verification plan');
  });
  it('escapes Markdown, HTML and injected newlines in API labels', () => {
    const unsafe = '[Run](javascript:alert(1))\n# forged <script> *bold* `code` \\ path';
    const escaped = handoffText(unsafe);
    expect(escaped).not.toContain('\n');
    expect(escaped).toContain('\\[Run\\]\\(javascript:alert\\(1\\)\\)');
    expect(escaped).toContain('\\# forged &lt;script&gt; \\*bold\\* \\`code\\` \\\\ path');
    expect(document([{ ...event, evidence: [{ ...event.evidence[0], label: unsafe }] }])).toContain(escaped);
  });
  it('prioritises severe incidents without changing the input array', () => {
    const critical = { ...event, event_id: 'EV-critical', severity: 'CRITICAL' as const };
    const input = [event, critical];
    const markdown = document(input);
    expect(markdown.indexOf('EV\\-critical')).toBeLessThan(markdown.indexOf('EV\\-1'));
    expect(input[0]).toBe(event);
  });
  it('labels real data LIVE and explicitly handles an empty selection', () => {
    const markdown = buildIncidentHandoff({ events: [], recommendations: [], source: { mode: 'REAL', label: 'Operations API' },
      filters: { status: 'session', startDate: '', endDate: '' }, loadedCount: 0, availableCount: 0 });
    expect(markdown).toContain('**LIVE**');
    expect(markdown).toContain('No incidents match');
  });
});
