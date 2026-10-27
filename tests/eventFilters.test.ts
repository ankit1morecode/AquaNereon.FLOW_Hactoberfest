import { describe, expect, it } from 'vitest';
import { filterEvents, readEventFilters, writeEventFilters } from '../src/services/eventFilters';
import type { WaterEvent } from '../src/types';

function event(overrides: Partial<WaterEvent>): WaterEvent {
  return {
    event_id: 'EV-1', node_id: 'AN-J-014', zone_id: 'Z-CENTRAL', event_type: 'FLOW_ANOMALY',
    timestamp: '2026-10-27T10:00:00Z', severity: 'HIGH', anomaly_score: 0.7, status: 'OPEN',
    state_transition: { from: 'DRIFT', to: 'DISTURBANCE' }, evidence: [], model_outputs: [],
    network_context: { upstream_states: [], downstream_states: [], propagation: 'LOCAL' },
    data_quality: { completeness: 1, confidence: 1, stale: false, suspect_channels: [] }, ...overrides,
  };
}

describe('event query filters', () => {
  it('normalizes unsupported URL values and round-trips shareable filters', () => {
    const params = writeEventFilters(new URLSearchParams('event=EV-2&other=keep'), { q: 'pressure rise', zone: 'Z-NORTH', severity: 'HIGH', sort: 'oldest' });
    expect(readEventFilters(params)).toEqual({ q: 'pressure rise', zone: 'Z-NORTH', severity: 'HIGH', status: '', sort: 'oldest' });
    expect(params.get('event')).toBeNull();
    expect(params.get('other')).toBe('keep');
    expect(readEventFilters(new URLSearchParams('severity=INVALID&status=BAD&sort=evil'))).toMatchObject({ severity: '', status: '', sort: 'priority' });
  });

  it('combines search, zone, severity, status and searches underlying evidence', () => {
    const events = [event({ evidence: [{ kind: 'PERSISTENCE', label: 'Persistence', value: 'rising pressure', weight: 1 }] }), event({ event_id: 'EV-2', zone_id: 'Z-NORTH' })];
    const filters = readEventFilters(new URLSearchParams('q=RISING&zone=Z-CENTRAL&severity=HIGH&status=OPEN'));
    expect(filterEvents(events, filters).map((value) => value.event_id)).toEqual(['EV-1']);
    expect(filterEvents(events, { ...filters, status: 'CLOSED' })).toEqual([]);
  });

  it('uses operational priority by default and leaves the source untouched', () => {
    const events = [event({ event_id: 'closed', severity: 'CRITICAL', status: 'CLOSED' }), event({ event_id: 'low', severity: 'LOW' }), event({ event_id: 'critical', severity: 'CRITICAL' })];
    expect(filterEvents(events, readEventFilters(new URLSearchParams())).map((value) => value.event_id)).toEqual(['critical', 'low', 'closed']);
    expect(events[0].event_id).toBe('closed');
  });

  it('supports oldest/newest and anomaly ordering with deterministic ties', () => {
    const events = [event({ event_id: 'older', timestamp: '2026-10-26T10:00:00Z', anomaly_score: 0.9 }), event({ event_id: 'newer', anomaly_score: 0.2 })];
    const filters = readEventFilters(new URLSearchParams());
    expect(filterEvents(events, { ...filters, sort: 'newest' })[0].event_id).toBe('newer');
    expect(filterEvents(events, { ...filters, sort: 'oldest' })[0].event_id).toBe('older');
    expect(filterEvents(events, { ...filters, sort: 'anomaly' })[0].event_id).toBe('older');
  });

  it('clears filter parameters and removes hidden selection without unrelated state loss', () => {
    const params = writeEventFilters(new URLSearchParams('q=leak&sort=oldest&zone=Z-A&event=EV-1&other=x'), { q: '', zone: '', sort: 'priority' });
    expect(params.toString()).toBe('other=x');
  });
});
