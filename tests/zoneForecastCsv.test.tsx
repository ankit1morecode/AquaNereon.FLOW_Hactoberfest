/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DemandForecast } from '../src/types';
import { zoneForecastToCsv } from '../src/services/zoneForecastCsv';
import { ForecastExport } from '../src/pages/ZoneIntelligence/ForecastExport';

const source = { mode: 'SIMULATION' as const, label: 'Local demo' };
function forecast(over: Partial<DemandForecast> = {}): DemandForecast {
  return { forecast_id: 'FC-ZONE', scope: 'ZONE', target_id: 'Z-ONE', model_id: 'profile-1',
    issued_at: '2026-10-27T15:30:00+05:30', horizon_hours: 24, backtest_mape: 4.5,
    history: [{ t: '2026-10-27T14:30:00+05:30', v: 92 }],
    forecast: [{ t: '2026-10-27T16:30:00+05:30', v: 100, lo: 90, hi: 110 }], ...over };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('zone forecast CSV', () => {
  it('exports loaded history, predictions, intervals and metadata with UTC plus original timestamps', () => {
    const rows = zoneForecastToCsv(forecast(), source).split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('"source_mode","source_label","scope","zone_id"');
    expect(rows[1]).toContain('"SIMULATION","Local demo","ZONE","Z-ONE","FC-ZONE","profile-1","2026-10-27T10:00:00.000Z","2026-10-27T15:30:00+05:30","24"');
    expect(rows[1].split(',').slice(9)).toEqual(['"history"', '"2026-10-27T09:00:00.000Z"', '"2026-10-27T14:30:00+05:30"', '""', '""', '""', '"92"', '"4.5"']);
    expect(rows[2].split(',').slice(9)).toEqual(['"forecast"', '"2026-10-27T11:00:00.000Z"', '"2026-10-27T16:30:00+05:30"', '"100"', '"90"', '"110"', '""', '"4.5"']);
  });
  it('leaves missing or invalid values empty without fabricating prediction bounds', () => {
    const csv = zoneForecastToCsv(forecast({ history: [], forecast: [{ t: 'invalid time', v: NaN }] }), { mode: 'REAL', label: 'Backend' });
    const row = csv.split('\r\n')[1];
    expect(row).toContain('"LIVE","Backend"');
    expect(row.split(',').slice(9)).toEqual(['"forecast"', '""', '"invalid time"', '""', '""', '""', '""', '"4.5"']);
  });
  it('quotes API labels and neutralizes formula-like cells', () => {
    const csv = zoneForecastToCsv(forecast({ model_id: '=HYPERLINK("https://example.test")', target_id: 'Zone, "North"' }), { mode: 'REAL', label: '@demo' });
    expect(csv).toContain('"\'@demo"');
    expect(csv).toContain('"Zone, ""North"""');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(zoneForecastToCsv(forecast({ forecast: [{ t: '2026-10-27T11:00:00Z', v: 1, lo: -5, hi: 7 }] }), source)).toContain('"1","-5","7"');
  });
  it('disables export for missing, empty, erroneous or wrong-zone data', () => {
    const view = render(<ForecastExport forecast={undefined} zoneId="Z-ONE" source={source} error={null} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    for (const data of [forecast({ forecast: [] }), forecast({ target_id: 'Z-TWO' }), forecast({ scope: 'CITY' })]) {
      view.rerender(<ForecastExport forecast={data} zoneId="Z-ONE" source={source} error={null} />);
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    }
    view.rerender(<ForecastExport forecast={forecast()} zoneId="Z-ONE" source={source} error={new Error('Offline')} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
  it('downloads the correct loaded forecast and cleans up the download resource', () => {
    const create = vi.fn((_blob: Blob) => 'blob:forecast'); const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: TimerHandler) => { if (typeof callback === 'function') callback(); return 1; }) as typeof window.setTimeout);
    render(<ForecastExport forecast={forecast()} zoneId="Z-ONE" source={source} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export forecast CSV' }));
    expect(click).toHaveBeenCalledOnce(); expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revoke).toHaveBeenCalledWith('blob:forecast'); expect(document.querySelector('a[download]')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Exported 1 forecast points and 1 history points for Z-ONE');
  });
});
