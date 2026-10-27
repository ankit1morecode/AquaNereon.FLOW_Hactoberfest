import type { DemandForecast } from '../types';
import { eventCsvCell } from './eventCsv';

export interface ForecastSource { mode: 'REAL' | 'SIMULATION'; label: string }
const utc = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
const csvCell = (value: string | number | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? `"${value}"` : eventCsvCell(value);

/** Export supplied history and forecast points without filling missing prediction bounds. */
export function zoneForecastToCsv(forecast: DemandForecast, source: ForecastSource): string {
  const metadata = [source.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE', source.label, forecast.scope,
    forecast.target_id, forecast.forecast_id, forecast.model_id, utc(forecast.issued_at), forecast.issued_at, forecast.horizon_hours];
  const headers = ['source_mode', 'source_label', 'scope', 'zone_id', 'forecast_id', 'model_id',
    'issued_at_utc', 'issued_at_original', 'horizon_hours', 'point_kind', 'timestamp_utc', 'timestamp_original',
    'predicted_lps', 'lower_lps', 'upper_lps', 'observed_lps', 'backtest_mape_percent'];
  const rows = [
    ...forecast.history.map((point) => [...metadata, 'history', utc(point.t), point.t, undefined, undefined, undefined, point.v, forecast.backtest_mape]),
    ...forecast.forecast.map((point) => [...metadata, 'forecast', utc(point.t), point.t, point.v, point.lo, point.hi, undefined, forecast.backtest_mape]),
  ];
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadZoneForecastCsv(forecast: DemandForecast, source: ForecastSource): void {
  const blob = new Blob([zoneForecastToCsv(forecast, source)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aquanereon-forecast-${forecast.target_id.replace(/[^A-Za-z0-9_.-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
