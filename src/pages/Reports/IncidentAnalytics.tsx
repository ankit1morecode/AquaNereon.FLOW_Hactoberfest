import { incidentAnalytics } from '../../services/reportAnalytics';
import type { WaterEvent, ZoneSummary } from '../../types';
import { BarRow } from '../../components/charts';
import { Empty, Panel } from '../../components/ui';
import './report-analytics.css';

export function IncidentAnalytics({ events, zones }: { events: WaterEvent[]; zones: ZoneSummary[] }) {
  const analytics = incidentAnalytics(events);
  return <section className="rp-analytics" aria-label="Incident analytics">
    <Panel title="Events by severity" subtitle={`${analytics.total} incidents in the selected report scope`}>
      {analytics.total === 0 ? <Empty>No incidents match this report scope.</Empty> : analytics.severity.map((bucket) => <BarRow key={bucket.label}
        label={bucket.label} value={bucket.count} max={Math.max(1, ...analytics.severity.map((item) => item.count))}
        caption={String(bucket.count)} color={bucket.label === 'CRITICAL' || bucket.label === 'HIGH' ? 'var(--state-disturbance)' : 'var(--a)'} />)}
    </Panel>
    <Panel title="Events by zone" subtitle="Ranked by incident count in the selected scope">
      {analytics.zones.length === 0 ? <Empty>No incidents match this report scope.</Empty> : analytics.zones.map((bucket) => <BarRow key={bucket.label}
        label={zones.find((zone) => zone.zone_id === bucket.label)?.name ?? bucket.label}
        value={bucket.count} max={Math.max(1, ...analytics.zones.map((item) => item.count))} caption={String(bucket.count)} />)}
    </Panel>
    <Panel title="Daily incident volume" subtitle="Local calendar dates of the selected loaded events">
      {analytics.days.length === 0 ? <Empty>No incidents with readable timestamps in this scope.</Empty> : <table className="rp-analytics-table">
        <thead><tr><th scope="col">Local date</th><th scope="col">Incidents</th></tr></thead>
        <tbody>{analytics.days.map((bucket) => <tr key={bucket.label}><th scope="row"><time dateTime={bucket.label}>{bucket.label}</time></th><td>{bucket.count}</td></tr>)}</tbody>
      </table>}
      <p className="rp-note">Counts cover the loaded event subset only. Dates without loaded incidents are omitted; this is not an exhaustive incident archive.</p>
      {analytics.invalidTimestamps > 0 && <p className="rp-note">{analytics.invalidTimestamps} selected incidents have unreadable timestamps and are excluded from daily totals.</p>}
    </Panel>
  </section>;
}
