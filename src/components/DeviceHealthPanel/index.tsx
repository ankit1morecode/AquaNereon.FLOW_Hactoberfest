import { useEffect, useState } from 'react';
import type { DataQuality, NodeHealth } from '../../types';
import { Empty, ErrorNote, HealthDot, Loading, Panel } from '../ui';
import './device-health.css';

export type HealthFreshness = 'recent' | 'stale' | 'future' | 'unknown' | 'simulation';
export function healthFreshness(timestamp: string, mode: 'REAL' | 'SIMULATION', now = Date.now()): HealthFreshness {
  if (mode === 'SIMULATION') return 'simulation';
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'unknown';
  if (time - now > 5000) return 'future';
  return now - time > 60_000 ? 'stale' : 'recent';
}

const FRESHNESS_LABEL: Record<HealthFreshness, string> = {
  recent: 'Health report is less than 60 seconds old.',
  stale: 'Health report is older than 60 seconds; these are last available readings.',
  future: 'Device report clock is ahead of this browser; freshness cannot be established.',
  unknown: 'Report timestamp is unavailable; freshness cannot be established.',
  simulation: 'Simulation clock · health values come from the platform simulator.',
};

function percent(value: number | undefined, scale = 1): string {
  if (value === undefined || !Number.isFinite(value) || value < 0 || value > scale) return 'Not reported';
  return `${(value / scale * 100).toFixed(1)}%`;
}

export function DeviceHealthPanel({ nodeId, report: supplied, quality, error, sourceMode }: {
  nodeId: string;
  report: NodeHealth | undefined;
  quality: DataQuality | undefined;
  error: Error | null;
  sourceMode: 'REAL' | 'SIMULATION';
}) {
  const [, setClock] = useState(0);
  useEffect(() => {
    if (sourceMode === 'SIMULATION') return;
    const timer = window.setInterval(() => setClock((previous) => previous + 1), 15_000);
    return () => window.clearInterval(timer);
  }, [sourceMode]);
  const report = supplied?.node_id === nodeId ? supplied : undefined;
  const freshness = report ? healthFreshness(report.timestamp, sourceMode) : 'unknown';
  const age = report?.telemetry_age_sec;
  const telemetryAge = age !== undefined && Number.isFinite(age) && age >= 0 ? `${age.toFixed(1)} s` : 'Not reported';
  const reportTimestamp = report && Number.isFinite(Date.parse(report.timestamp)) ? report.timestamp : null;
  return <Panel title="Device health" subtitle={`${nodeId} · ${sourceMode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'} · latest health report and signature quality`}>
    {error && <ErrorNote error={error} />}
    {!report ? error ? <Empty>No health report is available for this node.</Empty> : <Loading what="device health" /> : <>
      <p className={`device-health-freshness ${freshness === 'stale' || freshness === 'future' || freshness === 'unknown' ? 'device-health-warning' : ''}`} role="status">
        {FRESHNESS_LABEL[freshness]} {error && 'The retained report may be out of date.'}
      </p>
      <dl className="device-health-grid">
        {([
          ['Sensors', report.sensor_status], ['Power', report.power_status],
          ['Communications', report.communication_status], ['Calibration', report.calibration_status],
        ] as const).map(([label, status]) => <div key={label}><dt>{label}</dt><dd><HealthDot health={status} /> {status}</dd></div>)}
        <div><dt>Device-reported telemetry age</dt><dd>{telemetryAge}</dd></div>
        <div><dt>Packet loss</dt><dd>{percent(report.packet_loss)}</dd></div>
        <div><dt>Battery</dt><dd>{percent(report.battery_pct, 100)}</dd></div>
        <div><dt>Radio signal</dt><dd>{report.rssi_dbm !== undefined && Number.isFinite(report.rssi_dbm) ? `${report.rssi_dbm.toFixed(0)} dBm` : 'Not reported'}</dd></div>
        <div className="device-health-timestamp"><dt>Report timestamp</dt><dd>{reportTimestamp ? <time dateTime={reportTimestamp}>{reportTimestamp}</time> : 'Not reported'}</dd></div>
      </dl>
      {age !== undefined && Number.isFinite(age) && age > 60 && <p className="device-health-warning">The device reports telemetry older than 60 seconds.</p>}
      <h3 className="device-quality-title">Latest signature quality</h3>
      {quality ? <dl className="device-health-grid">
        <div><dt>Completeness</dt><dd>{percent(quality.completeness)}</dd></div>
        <div><dt>Confidence</dt><dd>{percent(quality.confidence)}</dd></div>
        <div><dt>Stale signature</dt><dd>{quality.stale ? 'Yes' : 'No'}</dd></div>
        <div><dt>Suspect channel indices</dt><dd>{quality.suspect_channels.length ? quality.suspect_channels.join(', ') : 'None reported'}</dd></div>
      </dl> : <Empty>Signature quality is not available.</Empty>}
      <p className="device-health-note">Statuses and telemetry age are reported by the device. Channel indices are the edge system’s reported identifiers; no per-channel health or environmental measurements are inferred.</p>
    </>}
  </Panel>;
}
