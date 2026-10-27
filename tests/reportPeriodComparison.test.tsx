/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { comparisonPeriods, compareReportPeriods } from '../src/services/reportPeriodComparison';
import { PeriodComparison } from '../src/pages/Reports/PeriodComparison';
import type { ReportFilters } from '../src/services/reportFilters';
import type { WaterEvent } from '../src/types';
afterEach(cleanup);
const scope: ReportFilters = { status: 'session', startDate: '2026-10-27', endDate: '2026-10-27' };
function event(id: string, date: Date, extra: Partial<WaterEvent> = {}): WaterEvent {
  return { event_id: id, timestamp: date.toISOString(), severity: 'HIGH', status: 'OPEN', ...extra } as WaterEvent;
}

describe('previous report period', () => {
  it('uses equal calendar lengths across daylight-saving dates and leap-year boundaries', () => {
    expect(comparisonPeriods({ ...scope, startDate: '2026-03-07', endDate: '2026-03-09' }).periods).toEqual({
      days: 3, current: { startDate: '2026-03-07', endDate: '2026-03-09' }, previous: { startDate: '2026-03-04', endDate: '2026-03-06' },
    });
    expect(comparisonPeriods({ ...scope, startDate: '2026-10-31', endDate: '2026-11-02' }).periods?.previous).toEqual({ startDate: '2026-10-28', endDate: '2026-10-30' });
    expect(comparisonPeriods({ ...scope, startDate: '2024-03-01', endDate: '2024-03-01' }).periods?.previous).toEqual({ startDate: '2024-02-29', endDate: '2024-02-29' });
  });
  it('keeps midnight boundaries exclusive and applies the same current status filter to both periods', () => {
    const events = [event('prior', new Date(2026, 9, 26, 23, 59, 59, 999)),
      event('current', new Date(2026, 9, 27, 0), { severity: 'LOW', status: 'CLOSED', verification_id: 'V-1' }),
      event('after', new Date(2026, 9, 28, 0))];
    const result = compareReportPeriods(events, scope);
    expect(result.metrics[0]).toMatchObject({ current: 1, previous: 1, difference: 0, percentChange: 0 });
    expect(result.metrics[1]).toMatchObject({ current: 0, previous: 1, percentChange: -100 });
    expect(result.metrics[3]).toMatchObject({ current: 1, previous: 0, percentChange: null });
    expect(compareReportPeriods(events, { ...scope, status: 'open' }).metrics[0]).toMatchObject({ current: 0, previous: 1 });
  });
  it('requires two valid dates and bounds the calendar range before comparison', () => {
    for (const invalid of [{ ...scope, startDate: '' }, { ...scope, startDate: '2026-10-28' },
      { ...scope, startDate: '2026-02-30' }, { ...scope, startDate: '2024-01-01', endDate: '2026-10-27' }]) {
      expect(comparisonPeriods(invalid).error).toBeTruthy();
      expect(compareReportPeriods([], invalid).metrics).toEqual([]);
    }
    expect(comparisonPeriods({ ...scope, startDate: '2024-01-01', endDate: '2024-12-31' }).periods?.days).toBe(366);
  });
  it('shows zero-baseline changes without claiming complete archive coverage', () => {
    render(<PeriodComparison events={[event('current', new Date(2026, 9, 27, 12))]} filters={scope} availableCount={500} />);
    const table = screen.getByRole('table', { name: 'Incident period comparison' });
    const row = within(table).getByRole('row', { name: /Incidents raised/ });
    expect(row.textContent).toContain('no previous baseline');
    expect(screen.getByText(/1 loaded of 500/)).toBeTruthy();
    expect(screen.getByText(/does not establish complete coverage/)).toBeTruthy();
  });
});
