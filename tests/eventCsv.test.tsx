/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { eventCsvCell, eventsToCsv } from '../src/services/eventCsv';
import { filterEvents, readEventFilters } from '../src/services/eventFilters';
import { EventCsvExport } from '../src/pages/Events/EventCsvExport';
import type { WaterEvent } from '../src/types';

function event(overrides: Partial<WaterEvent> = {}): WaterEvent {
  return {
    event_id: 'EV-1', node_id: 'AN-J-014', zone_id: 'Z-CENTRAL', event_type: 'FLOW_ANOMALY',
    timestamp: '2026-10-27T10:00:00Z', severity: 'HIGH', anomaly_score: 0.7, status: 'OPEN',
    state_transition: { from: 'DRIFT', to: 'DISTURBANCE' }, evidence: [], model_outputs: [],
    network_context: { upstream_states: [], downstream_states: [], propagation: 'LOCAL' },
    data_quality: { completeness: 1, confidence: 0.9, stale: false, suspect_channels: [] }, ...overrides,
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('filtered event CSV exports', () => {
  it('exports the filtered result and current ordering, excluding hidden events', () => {
    const events = [event({ event_id: 'old', timestamp: '2026-10-26T10:00:00Z' }), event({ event_id: 'hidden', zone_id: 'Z-NORTH' }), event({ event_id: 'new' })];
    const filtered = filterEvents(events, readEventFilters(new URLSearchParams('zone=Z-CENTRAL&sort=newest')));
    const csv = eventsToCsv(filtered);
    expect(csv.startsWith('\uFEFF"event_id"')).toBe(true);
    expect(csv).not.toContain('hidden');
    expect(csv.indexOf('"new"')).toBeLessThan(csv.indexOf('"old"'));
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(eventsToCsv([]).split('\r\n')).toHaveLength(2);
  });

  it('escapes commas, quotes, newlines and Unicode without losing evidence text', () => {
    const csv = eventsToCsv([event({ suspected_origin: { description: 'North, "ring"\nΔ pressure', confidence: 0.8 } })]);
    expect(csv).toContain('"North, ""ring""\nΔ pressure"');
    expect(eventCsvCell(undefined)).toBe('""');
    expect(eventCsvCell(Number.NaN)).toBe('""');
  });

  it('neutralizes formulas and dangerous leading control characters', () => {
    for (const value of ['=HYPERLINK("x")', '+cmd', '-2+3', '@SUM(A1)', '  =SUM(A1)', '\t=SUM(A1)', '\nmalicious']) {
      expect(eventCsvCell(value).startsWith('"\'')).toBe(true);
    }
    expect(eventCsvCell('AN-J-014')).toBe('"AN-J-014"');
    expect(eventCsvCell(0.7)).toBe('"0.7"');
  });

  it('disables empty exports and downloads a CSV with cleanup after exporting', () => {
    const create = vi.fn((_blob: Blob) => 'blob:event-export');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const timer = vi.spyOn(window, 'setTimeout').mockImplementation(((fn: TimerHandler) => { if (typeof fn === 'function') fn(); return 1; }) as typeof window.setTimeout);
    const { rerender } = render(<EventCsvExport events={[]} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    rerender(<EventCsvExport events={[event()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV (1)' }));
    expect(click).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revoke).toHaveBeenCalledWith('blob:event-export');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Exported 1 matching events');
    timer.mockRestore();
  });
});
