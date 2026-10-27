/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { incidentAnalytics } from '../src/services/reportAnalytics';
import { filterReportEvents } from '../src/services/reportFilters';
import { IncidentAnalytics } from '../src/pages/Reports/IncidentAnalytics';
import type { WaterEvent } from '../src/types';
afterEach(cleanup);
function event(id: string, day: number, severity: WaterEvent['severity'], zone: string, status: WaterEvent['status'] = 'OPEN'): WaterEvent {
  return { event_id: id, timestamp: new Date(2026, 9, day, 12).toISOString(), severity, zone_id: zone, status } as WaterEvent;
}

describe('scoped incident analytics', () => {
  it('keeps every breakdown consistent with the report date and status filters', () => {
    const events = [event('a', 27, 'HIGH', 'Z-A'), event('b', 27, 'CRITICAL', 'Z-B', 'CLOSED'), event('c', 26, 'LOW', 'Z-A')];
    const selected = filterReportEvents(events, { status: 'open', startDate: '2026-10-27', endDate: '2026-10-27' });
    const result = incidentAnalytics(selected);
    expect(result.total).toBe(1);
    expect(result.severity.find((bucket) => bucket.label === 'HIGH')?.count).toBe(1);
    expect(result.zones).toEqual([{ label: 'Z-A', count: 1 }]);
    expect(result.days).toEqual([{ label: '2026-10-27', count: 1 }]);
  });
  it('assigns both local midnight boundaries to their own day and keeps malformed time visible in counts', () => {
    const events = [event('a', 27, 'HIGH', 'Z-A'), event('b', 28, 'LOW', 'Z-B')];
    events[0].timestamp = new Date(2026, 9, 27, 23, 59, 59, 999).toISOString();
    events[1].timestamp = new Date(2026, 9, 28, 0).toISOString();
    const result = incidentAnalytics([...events, { ...events[0], event_id: 'bad', timestamp: 'unreadable' }]);
    expect(result.days.map((bucket) => bucket.label)).toEqual(['2026-10-27', '2026-10-28']);
    expect(result.invalidTimestamps).toBe(1);
    expect(result.severity.reduce((sum, item) => sum + item.count, 0)).toBe(3);
    expect(result.zones.reduce((sum, item) => sum + item.count, 0)).toBe(3);
  });
  it('renders an accessible daily table and discloses incomplete loaded scope', () => {
    render(<IncidentAnalytics events={[event('a', 27, 'HIGH', 'Z-A')]} zones={[]} />);
    const region = screen.getByRole('region', { name: 'Incident analytics' });
    expect(within(region).getByRole('columnheader', { name: 'Local date' })).toBeTruthy();
    expect(within(region).getByText('2026-10-27')).toBeTruthy();
    expect(within(region).getByText(/Dates without loaded incidents are omitted/)).toBeTruthy();
  });
});
