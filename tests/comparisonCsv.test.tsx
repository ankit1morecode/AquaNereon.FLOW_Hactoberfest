/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComparisonCsvExport } from '../src/pages/NodeComparison/ComparisonCsvExport';
import { comparisonCsvCell, comparisonToCsv } from '../src/services/comparisonCsv';
import type { NodeSummary } from '../src/types';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function node(id: string, flow: number, over: Partial<NodeSummary> = {}): NodeSummary {
  return { node_id: id, zone_id: 'Z-NORTH', location: { label: 'North', lat: 0, lng: 0 }, state: 'DRIFT', health: 'OK',
    flow_lps: flow, nominal_flow_lps: 40, anomaly_score: .2, sampling_mode: 'NORMAL', last_seen: '2026-10-27T15:30:00+05:30', ...over } as NodeSummary;
}
const source = { mode: 'SIMULATION' as const, label: 'Browser model' };

describe('comparison snapshot CSV', () => {
  it('keeps the table order and computes differences from its first selected row', () => {
    const rows = comparisonToCsv([node('B', 20), node('A', 15)], source, '2026-10-27T10:01:00Z').split('\r\n');
    expect(rows).toHaveLength(4);
    const first = rows[1].split(',');
    const second = rows[2].split(',');
    expect(first.slice(3, 5)).toEqual(['"B"', '"B"']);
    expect(second.slice(3, 5)).toEqual(['"B"', '"A"']);
    expect(second[10]).toBe('"-5"');
    expect(first[10]).toBe('"0"');
    expect(second[12]).toBe('"37.5"');
    expect(first[0]).toBe('"2026-10-27T10:01:00.000Z"');
    expect(first[1]).toBe('"SIMULATION"');
  });
  it('preserves source timestamps while normalizing valid timestamps to UTC', () => {
    const rows = comparisonToCsv([node('A', 20), node('B', 30, { last_seen: 'unknown' })], { mode: 'REAL', label: 'Backend' }).split('\r\n');
    expect(rows[1].split(',').slice(-2)).toEqual(['"2026-10-27T10:00:00.000Z"', '"2026-10-27T15:30:00+05:30"']);
    expect(rows[2].split(',').slice(-2)).toEqual(['""', '"unknown"']);
    expect(rows[1]).toContain('"LIVE"');
  });
  it('leaves unavailable numeric values blank and protects spreadsheet text', () => {
    expect(comparisonCsvCell(-5)).toBe('"-5"');
    expect(comparisonCsvCell('  =HYPERLINK("x")')).toBe('"\'  =HYPERLINK(""x"")"');
    expect(comparisonCsvCell('North, "河"')).toBe('"North, ""河"""');
    const csv = comparisonToCsv([node('A', 20, { nominal_flow_lps: 0 }), node('B', NaN)], source);
    expect(csv).not.toContain('NaN');
    expect(csv).not.toContain('Infinity');
  });
  it('disables unavailable snapshots and downloads only selected loaded rows with cleanup', () => {
    vi.useFakeTimers();
    const create = vi.fn((_blob: Blob) => 'blob:comparison');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const view = render(<ComparisonCsvExport nodes={[node('A', 20)]} source={source} error={null} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<ComparisonCsvExport nodes={[node('A', 20), node('B', 30)]} source={source} error={new Error('Stale')} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<ComparisonCsvExport nodes={[node('A', 20), node('B', 30)]} source={source} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export comparison CSV' }));
    expect(click).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(screen.getByRole('status').textContent).toContain('Exported 2 comparison rows');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:comparison');
  });
});
