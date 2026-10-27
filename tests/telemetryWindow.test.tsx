/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { TelemetryFrame } from '../src/types';
import { selectTelemetryFrames, useTelemetryWindow } from '../src/services/telemetryWindow';
import { TelemetryWindowControls } from '../src/components/TelemetryWindowControls';

afterEach(cleanup);
function frame(seconds: number, node_id = 'A'): TelemetryFrame {
  return { node_id, timestamp: new Date(1_700_000_000_000 + seconds * 1000).toISOString(),
    flow: { a: 1, b: 2, out: 3 }, pressure: { a: 300, b: 310, out: 290 }, acoustic_rms: 0.2,
    conductivity_us_cm: 400, turbidity_ntu: 0.1, temperature_c: 18,
    circumferential_channels: [1, 2], data_quality: { completeness: 1, confidence: 0.9, stale: false, suspect_channels: [] } };
}

describe('telemetry time windows', () => {
  it('uses the latest loaded sample clock, inclusive boundaries, chronological order and asset identity', () => {
    const frames = [frame(60), frame(0), frame(45), frame(46), frame(90, 'B'), { ...frame(62), timestamp: 'invalid' }];
    expect(selectTelemetryFrames(frames, 'A', '15').map((item) => item.timestamp)).toEqual([frame(45), frame(46), frame(60)].map((item) => item.timestamp));
    expect(selectTelemetryFrames(frames, 'A', '60')).toHaveLength(4);
    expect(selectTelemetryFrames([], 'A', 'all')).toEqual([]);
    expect(frames[0].timestamp).toBe(frame(60).timestamp);
  });
  it('captures immutable raw data, resumes new samples and resets when the node changes', () => {
    const loaded = [frame(0), frame(10)];
    const view = renderHook(({ id, frames }) => useTelemetryWindow(id, frames), { initialProps: { id: 'A', frames: loaded } });
    act(() => view.result.current.freeze());
    loaded[0].flow.a = 99;
    loaded[0].circumferential_channels[0] = 99;
    view.rerender({ id: 'A', frames: [...loaded, frame(20)] });
    expect(view.result.current.frozen).toBe(true);
    expect(view.result.current.frames).toHaveLength(2);
    expect(view.result.current.frames[0].flow.a).toBe(1);
    expect(view.result.current.frames[0].circumferential_channels[0]).toBe(1);
    act(() => view.result.current.resume());
    expect(view.result.current.frames).toHaveLength(3);
    act(() => view.result.current.freeze());
    view.rerender({ id: 'B', frames: loaded });
    expect(view.result.current.frozen).toBe(false);
    expect(view.result.current.frames).toEqual([]);
    view.rerender({ id: 'A', frames: loaded });
    expect(view.result.current.frozen).toBe(false);
  });
  it('offers range and freeze controls and explains loaded scope', () => {
    function Harness() { return <TelemetryWindowControls window={useTelemetryWindow('A', [frame(0), frame(60)])} />; }
    render(<Harness />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '15' } });
    expect(screen.getByRole('status').textContent).toContain('1 shown of 2 loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Freeze traces' }));
    expect(screen.getByRole('status').textContent).toContain('Frozen capture');
    fireEvent.click(screen.getByRole('button', { name: 'Resume live traces' }));
    expect(screen.getByRole('status').textContent).toContain('Live loaded samples');
  });
});
