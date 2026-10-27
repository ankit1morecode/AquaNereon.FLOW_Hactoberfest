import { describe, expect, it } from 'vitest';
import { filterReportEvents, reportFilterError, reportStatistics } from '../src/services/reportFilters';
import type { ReportFilters } from '../src/services/reportFilters';
import type { WaterEvent } from '../src/types';

const scope: ReportFilters = { status: 'session', startDate: '2026-10-27', endDate: '2026-10-27' };
function event(id: string, date: Date, extra: Partial<WaterEvent> = {}): WaterEvent {
  return { event_id: id, timestamp: date.toISOString(), status: 'OPEN', node_id: 'AN-1',
    event_type: 'FLOW_ANOMALY', ...extra } as WaterEvent;
}
const events = [
  event('before', new Date(2026, 9, 26, 23, 59, 59, 999)),
  event('start', new Date(2026, 9, 27), { intervention_id: 'I-1' }),
  event('end', new Date(2026, 9, 27, 23, 59, 59, 999), { status: 'CLOSED', verification_id: 'V-1', node_id: 'AN-2', event_type: 'SENSOR_FAULT' }),
  event('after', new Date(2026, 9, 28)),
];

describe('report calendar scope', () => {
  it('includes both boundaries of the local calendar day and excludes surrounding days', () => {
    expect(filterReportEvents(events, scope).map((item) => item.event_id)).toEqual(['start', 'end']);
  });
  it('combines status and date for all downstream report statistics', () => {
    const filtered = filterReportEvents(events, { ...scope, status: 'closed' });
    const stats = reportStatistics(filtered);
    expect(stats).toMatchObject({ total: 1, closed: 1, verified: 1, intervened: 0, verificationRate: 1 });
    expect(stats.byType).toEqual([['SENSOR_FAULT', 1]]);
    expect(stats.byNode).toEqual([['AN-2', 1]]);
    expect(filterReportEvents(events, { ...scope, status: 'open' }).map((item) => item.event_id)).toEqual(['start']);
  });
  it('supports open-ended ranges and clearing all filters', () => {
    expect(filterReportEvents(events, { ...scope, endDate: '' })).toHaveLength(3);
    expect(filterReportEvents(events, { ...scope, startDate: '' })).toHaveLength(3);
    expect(filterReportEvents(events, { status: 'session', startDate: '', endDate: '' })).toEqual(events);
  });
  it('rejects reversed ranges and impossible calendar dates', () => {
    for (const invalid of [{ ...scope, startDate: '2026-10-28' }, { ...scope, endDate: '2026-02-30' }, { ...scope, startDate: 'garbage' }]) {
      expect(reportFilterError(invalid)).toBeTruthy();
      expect(filterReportEvents(events, invalid)).toEqual([]);
    }
    expect(reportFilterError({ ...scope, startDate: '2024-02-29', endDate: '' })).toBeNull();
  });
  it('does not include malformed timestamps in a bounded report', () => {
    expect(filterReportEvents([{ ...events[0], timestamp: 'invalid' }], scope)).toEqual([]);
  });
  it('keeps the next local midnight exclusive across daylight-saving calendar dates', () => {
    const dstScope = { ...scope, startDate: '2026-03-08', endDate: '2026-03-08' };
    const samples = [event('late', new Date(2026, 2, 8, 23, 59)), event('next', new Date(2026, 2, 9))];
    expect(filterReportEvents(samples, dstScope).map((item) => item.event_id)).toEqual(['late']);
  });
});
