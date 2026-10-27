/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TelemetryFrame } from '../src/types';
import { telemetryCsvCell, telemetryToCsv, type TelemetryExportScope } from '../src/services/telemetryCsv';
import { TelemetryCsvExport } from '../src/components/TelemetryCsvExport';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const frame: TelemetryFrame = { node_id: 'A', timestamp: '2026-10-27T15:30:00+05:30',
  flow: { a: 1, b: 2, out: 3 }, pressure: { a: 300, b: 310, out: 290 }, acoustic_rms: 0.2,
  conductivity_us_cm: 400, turbidity_ntu: 0.1, temperature_c: 18,
  circumferential_channels: Array.from({ length: 16 }, (_, index) => index + 1),
  data_quality: { completeness: 0.95, confidence: 0.9, stale: false, suspect_channels: [2, 5] } };
const scope: TelemetryExportScope = { nodeId: 'A', sourceMode: 'SIMULATION', range: '15', capturedAt: '2026-10-27T10:01:00Z' };

describe('displayed telemetry CSV', () => {
  it('exports only selected-node rows with normalized and original timestamps, frozen scope and all ring channels', () => {
    const csv = telemetryToCsv([frame, { ...frame, node_id: 'B' }], scope);
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('"ring_channel_16"');
    expect(rows[1]).toContain('"A","SIMULATION","frozen","latest_15_seconds","2026-10-27T10:01:00.000Z","2026-10-27T10:00:00.000Z","2026-10-27T15:30:00+05:30"');
    expect(rows[1]).toContain('"0.95","0.9","false","2;5"');
    expect(rows[1]).toMatch(/"15","16"$/);
    expect(telemetryToCsv([], scope).trim().split('\r\n')).toHaveLength(1);
  });
  it('quotes embedded quotes/newlines and neutralizes spreadsheet formulas and nonfinite numbers', () => {
    expect(telemetryCsvCell('a,"b"\nline')).toBe('"a,""b""\nline"');
    for (const value of ['=SUM(A1)', ' +cmd', '@SUM(A1)', '\tformula']) expect(telemetryCsvCell(value).startsWith('"\'')).toBe(true);
    expect(telemetryCsvCell(NaN)).toBe('""');
    expect(telemetryCsvCell(-2)).toBe('"-2"');
    expect(telemetryCsvCell(undefined)).toBe('""');
  });
  it('disables empty/mismatched-node exports and downloads the exact displayed count with cleanup', () => {
    const create = vi.fn((_blob: Blob) => 'blob:telemetry');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => { if (typeof handler === 'function') handler(); return 1; }) as typeof window.setTimeout);
    const view = render(<TelemetryCsvExport frames={[{ ...frame, node_id: 'B' }]} scope={scope} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<TelemetryCsvExport frames={[frame]} scope={scope} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export telemetry CSV (1)' }));
    expect(click).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revoke).toHaveBeenCalledWith('blob:telemetry');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('1 displayed frozen samples from SIMULATION');
  });
});
