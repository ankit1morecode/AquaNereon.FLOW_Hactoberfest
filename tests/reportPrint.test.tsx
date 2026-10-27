/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Reports } from '../src/pages/Reports';
import type { WaterEvent } from '../src/types';

const fixtures = vi.hoisted(() => ({ events: [] as WaterEvent[], mode: 'SIMULATION' as 'REAL' | 'SIMULATION' }));
vi.mock('../src/services/ApiProvider', () => ({
  useApi: () => ({ mode: fixtures.mode, label: 'Example data source' }),
  useQuery: (fetcher: (client: object) => unknown) => ({ data: fetcher({
    getEvents: () => ({ items: fixtures.events, total: 400 }), getRecommendations: () => [],
    getForecasts: () => [], getZones: () => [], getNodes: () => [],
  }), error: null, loading: false }),
}));
vi.mock('../src/components/EventTimeline', () => ({ EventTimeline: () => <div>Event history</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('printable report', () => {
  it('prints current filtered metadata and releases print styles when the report unmounts', () => {
    fixtures.mode = 'SIMULATION';
    fixtures.events = [{ event_id: 'current', node_id: 'AN-1', event_type: 'FLOW_ANOMALY', timestamp: new Date(2026, 9, 27, 12).toISOString(), status: 'OPEN', severity: 'HIGH', zone_id: 'Z-A' } as WaterEvent];
    const print = vi.spyOn(globalThis, 'print').mockImplementation(() => undefined);
    const view = render(<Reports />);
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-27' } });
    fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2026-10-27' } });
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const metadata = screen.getByTestId('print-report-metadata');
    expect(metadata.textContent).toContain('SIMULATION');
    expect(metadata.textContent).toContain('2026-10-27 through 2026-10-27');
    expect(metadata.textContent).toContain('Status: open');
    expect(metadata.textContent).toContain('1 matching incidents from 1 loaded of 400');
    expect(document.body.classList.contains('report-print-active')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Print report' }));
    expect(print).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.body.classList.contains('report-print-active')).toBe(false);
  });
  it('labels live data and prevents printing a reversed report range', () => {
    fixtures.mode = 'REAL'; fixtures.events = [];
    const print = vi.spyOn(globalThis, 'print').mockImplementation(() => undefined);
    render(<Reports />);
    expect(within(screen.getByTestId('print-report-metadata')).getByText('LIVE')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-28' } });
    fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2026-10-27' } });
    const button = screen.getByRole('button', { name: 'Print report' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(print).not.toHaveBeenCalled();
  });
});
