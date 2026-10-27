import { useEffect, useMemo, useState } from 'react';
import type { TelemetryFrame } from '../types';

export const TELEMETRY_RANGES = [
  { value: 'all', label: 'All loaded samples' },
  { value: '60', label: 'Latest 60 seconds' },
  { value: '15', label: 'Latest 15 seconds' },
] as const;
export type TelemetryRange = (typeof TELEMETRY_RANGES)[number]['value'];

/** Restrict to the selected asset, then use the newest loaded timestamp as the clock. */
export function selectTelemetryFrames(frames: TelemetryFrame[], nodeId: string, range: TelemetryRange): TelemetryFrame[] {
  const valid = frames.filter((frame) => frame.node_id === nodeId && Number.isFinite(Date.parse(frame.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (range === 'all' || valid.length === 0) return valid;
  const cutoff = Date.parse(valid[valid.length - 1].timestamp) - Number(range) * 1000;
  return valid.filter((frame) => Date.parse(frame.timestamp) >= cutoff);
}

export function copyTelemetryFrames(frames: TelemetryFrame[]): TelemetryFrame[] {
  return frames.map((frame) => ({ ...frame, flow: { ...frame.flow }, pressure: { ...frame.pressure },
    circumferential_channels: [...frame.circumferential_channels],
    data_quality: { ...frame.data_quality, suspect_channels: [...frame.data_quality.suspect_channels] } }));
}

export function useTelemetryWindow(nodeId: string, loaded: TelemetryFrame[]) {
  const [range, setRange] = useState<TelemetryRange>('all');
  const [snapshot, setSnapshot] = useState<{ nodeId: string; frames: TelemetryFrame[]; capturedAt: string } | null>(null);
  useEffect(() => { setSnapshot(null); setRange('all'); }, [nodeId]);
  const frozen = snapshot?.nodeId === nodeId;
  const source = frozen ? snapshot.frames : loaded;
  const frames = useMemo(() => selectTelemetryFrames(source, nodeId, range), [source, nodeId, range]);
  const loadedCount = selectTelemetryFrames(source, nodeId, 'all').length;
  return { range, setRange, frames, loadedCount, frozen,
    capturedAt: frozen ? snapshot.capturedAt : null,
    freeze() {
      const current = selectTelemetryFrames(loaded, nodeId, 'all');
      if (current.length) setSnapshot({ nodeId, frames: copyTelemetryFrames(current), capturedAt: new Date().toISOString() });
    },
    resume() { setSnapshot(null); },
  };
}
