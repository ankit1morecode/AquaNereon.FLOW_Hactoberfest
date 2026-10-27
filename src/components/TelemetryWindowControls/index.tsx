import { TELEMETRY_RANGES, type TelemetryRange, type useTelemetryWindow } from '../../services/telemetryWindow';
import './telemetry.css';

export function TelemetryWindowControls({ window }: { window: ReturnType<typeof useTelemetryWindow> }) {
  const { frames } = window;
  const first = frames[0]?.timestamp;
  const last = frames[frames.length - 1]?.timestamp;
  return <div className="telemetry-workspace">
    <div className="telemetry-tools">
      <label>Telemetry time window <select value={window.range} onChange={(event) => window.setRange(event.target.value as TelemetryRange)}>
        {TELEMETRY_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
      </select></label>
      <button type="button" className="btn" disabled={!window.frozen && !frames.length}
        onClick={() => window.frozen ? window.resume() : window.freeze()}>
        {window.frozen ? 'Resume live traces' : 'Freeze traces'}
      </button>
    </div>
    <p className="telemetry-scope" role="status">
      {window.frozen ? `Frozen capture · ${window.capturedAt}` : 'Live loaded samples'} · {frames.length} shown of {window.loadedCount} loaded.
      {first && last && <> Sample range: <time dateTime={first}>{first}</time> to <time dateTime={last}>{last}</time>.</>}
      {' '}Windows end at the latest loaded sample; older samples outside this API response are not included.
    </p>
  </div>;
}
