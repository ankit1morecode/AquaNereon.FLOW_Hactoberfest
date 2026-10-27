import { useState } from 'react';
import type { TelemetryFrame } from '../../types';
import { downloadTelemetryCsv, type TelemetryExportScope } from '../../services/telemetryCsv';

export function TelemetryCsvExport({ frames, scope }: { frames: TelemetryFrame[]; scope: TelemetryExportScope }) {
  const [notice, setNotice] = useState('');
  const selected = frames.filter((frame) => frame.node_id === scope.nodeId);
  return <div className="telemetry-export">
    <button type="button" className="btn" disabled={!selected.length} onClick={() => {
      try {
        downloadTelemetryCsv(selected, scope);
        setNotice(`Exported ${selected.length} displayed ${scope.capturedAt ? 'frozen' : 'live'} samples from ${scope.sourceMode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'} data.`);
      } catch (error) { setNotice(`Could not export telemetry: ${error instanceof Error ? error.message : String(error)}`); }
    }}>Export telemetry CSV ({selected.length})</button>
    <span className="telemetry-scope"> {scope.sourceMode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'} · displayed samples only</span>
    {notice && <p className="telemetry-scope" role="status">{notice}</p>}
  </div>;
}
