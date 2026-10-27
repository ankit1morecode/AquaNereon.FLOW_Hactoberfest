import type { WaterEvent } from '../../types';
import type { ReportFilters } from '../../services/reportFilters';
import { compareReportPeriods } from '../../services/reportPeriodComparison';
import { reportDayKey } from '../../services/reportAnalytics';
import { Empty, Panel } from '../../components/ui';

export function PeriodComparison({ events, filters, availableCount }: { events: WaterEvent[]; filters: ReportFilters; availableCount: number }) {
  const comparison = compareReportPeriods(events, filters);
  const days = events.map((event) => reportDayKey(event.timestamp)).filter((day): day is string => day !== null).sort();
  return <Panel title="Previous-period comparison" subtitle="Equal inclusive local calendar periods, grouped by incident-raised date">
    {!comparison.periods ? <Empty>{comparison.error}</Empty> : <>
      <p className="rp-note">Current: {comparison.periods.current.startDate} through {comparison.periods.current.endDate}. Previous: {comparison.periods.previous.startDate} through {comparison.periods.previous.endDate}. Each covers {comparison.periods.days} calendar days.</p>
      <table className="rp-analytics-table" aria-label="Incident period comparison">
        <thead><tr><th scope="col">Metric</th><th scope="col">Current</th><th scope="col">Previous</th><th scope="col">Change</th></tr></thead>
        <tbody>{comparison.metrics.map((metric) => <tr key={metric.label}><th scope="row">{metric.label}</th><td>{metric.current}</td><td>{metric.previous}</td>
          <td>{metric.difference > 0 ? '+' : ''}{metric.difference} · {metric.percentChange === null ? 'no previous baseline' : `${metric.percentChange > 0 ? '+' : ''}${metric.percentChange.toFixed(1)}%`}</td>
        </tr>)}</tbody>
      </table>
      <p className="rp-note">Both periods use the selected status filter and the incidents’ currently reported statuses and verification references. Counts cover {events.length} loaded of {availableCount} available events. Older incidents may be absent from this loaded subset.</p>
      {days.length > 0 && <p className="rp-note">Loaded event dates span {days[0]} through {days[days.length - 1]}; this span does not establish complete coverage of either period.</p>}
    </>}
  </Panel>;
}
