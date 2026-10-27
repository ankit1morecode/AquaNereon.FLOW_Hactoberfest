import type { ReportFilters } from '../../services/reportFilters';

export function PrintReportHeader({ source, filters, selectedCount, loadedCount, availableCount }: {
  source: { mode: 'REAL' | 'SIMULATION'; label: string }; filters: ReportFilters;
  selectedCount: number; loadedCount: number; availableCount: number;
}) {
  const generatedAt = new Date().toISOString();
  return <header className="rp-print-header" data-testid="print-report-metadata">
    <h1>AquaNereon.FLOW incident report</h1>
    <p>Source: <strong>{source.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'}</strong> · {source.label}</p>
    <p>Incident date range: {filters.startDate || 'any start'} through {filters.endDate || 'any end'} (inclusive local calendar dates; {Intl.DateTimeFormat().resolvedOptions().timeZone}). Status: {filters.status === 'session' ? 'all loaded statuses' : filters.status}.</p>
    <p>{selectedCount} matching incidents from {loadedCount} loaded of {availableCount} available. This report covers the loaded subset only.</p>
    <p>Forecast performance is the latest available backtest and is independent of the incident date range.</p>
    <p>View generated: <time dateTime={generatedAt}>{generatedAt}</time></p>
  </header>;
}
