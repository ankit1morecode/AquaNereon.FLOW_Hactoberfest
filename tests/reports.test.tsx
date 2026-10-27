/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WaterEvent } from '../src/types';
import { Reports } from '../src/pages/Reports';

const fixtures = vi.hoisted(() => ({ events: [] as WaterEvent[] }));
vi.mock('../src/services/ApiProvider', () => ({
  useApi: () => ({ mode: 'SIMULATION', label: 'Test simulator' }),
  useQuery: (fetcher: (client: object) => unknown) => ({ data: fetcher({
    getEvents: () => ({ items: fixtures.events, total: 450 }),
    getRecommendations: () => [], getForecasts: () => [], getZones: () => [], getNodes: () => [],
  }), error: null, loading: false }),
}));
vi.mock('../src/components/EventTimeline', () => ({
  EventTimeline: ({ events }: { events: WaterEvent[] }) => <div data-testid="report-incidents">{events.map((event) => event.event_id).join(', ')}</div>,
}));
afterEach(cleanup);

function load() {
  fixtures.events = [
    { event_id: 'current', timestamp: new Date(2026, 9, 27, 12).toISOString(), status: 'CLOSED',
      node_id: 'AN-1', event_type: 'SENSOR_FAULT', verification_id: 'V-1' } as WaterEvent,
    { event_id: 'previous', timestamp: new Date(2026, 9, 26, 12).toISOString(), status: 'OPEN',
      node_id: 'AN-2', event_type: 'FLOW_ANOMALY' } as WaterEvent,
  ];
  return render(<Reports />);
}

describe('report controls', () => {
  it('keeps visible count, event list and status scope in sync and can clear the range', () => {
    load();
    expect(screen.getByRole('status').textContent).toContain('2 matching events from 2 loaded of 450');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-27' } });
    fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2026-10-27' } });
    expect(screen.getByRole('status').textContent).toContain('1 matching events');
    expect(screen.getByTestId('report-incidents').textContent).toBe('current');
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByRole('status').textContent).toContain('0 matching events');
    expect((screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Export incident handoff' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('report-incidents').textContent).toContain('previous');
    expect(screen.getByRole('button', { name: 'session' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('shows range validation and prevents both exports while the range is reversed', () => {
    load();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-28' } });
    fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2026-10-27' } });
    expect(screen.getByRole('alert').textContent).toContain('on or before');
    expect((screen.getByRole('button', { name: 'Export incident handoff' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
