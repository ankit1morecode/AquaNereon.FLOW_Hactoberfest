/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DeviceHealthPanel, healthFreshness } from '../src/components/DeviceHealthPanel';
import type { NodeHealth } from '../src/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function health(overrides: Partial<NodeHealth> = {}): NodeHealth {
  return { node_id: 'A', timestamp: new Date().toISOString(), sensor_status: 'DEGRADED', power_status: 'OK',
    communication_status: 'FAULT', calibration_status: 'OK', telemetry_age_sec: 2, packet_loss: 0.1,
    battery_pct: 0, rssi_dbm: -73, ...overrides };
}
const quality = { completeness: 0.95, confidence: 0.8, stale: false, suspect_channels: [2, 5] };

describe('device health details', () => {
  it('distinguishes recent, stale, skewed, missing and simulation clocks', () => {
    const now = 1_700_000_000_000;
    expect(healthFreshness(new Date(now - 59_000).toISOString(), 'REAL', now)).toBe('recent');
    expect(healthFreshness(new Date(now - 61_000).toISOString(), 'REAL', now)).toBe('stale');
    expect(healthFreshness(new Date(now + 10_000).toISOString(), 'REAL', now)).toBe('future');
    expect(healthFreshness('invalid', 'REAL', now)).toBe('unknown');
    expect(healthFreshness(new Date(now + 3600_000).toISOString(), 'SIMULATION', now)).toBe('simulation');
  });
  it('shows API status, genuine zero battery, signal and reported signature quality', () => {
    render(<DeviceHealthPanel nodeId="A" report={health()} quality={quality} error={null} sourceMode="REAL" />);
    expect(screen.getByText('Power')).toBeTruthy();
    expect(screen.getByText('0.0%')).toBeTruthy();
    expect(screen.getByText('-73 dBm')).toBeTruthy();
    expect(screen.getByText('10.0%')).toBeTruthy();
    expect(screen.getByText('95.0%')).toBeTruthy();
    expect(screen.getByText('2, 5')).toBeTruthy();
  });
  it('marks stale reports as time passes even without fresh API payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    render(<DeviceHealthPanel nodeId="A" report={health()} quality={undefined} error={null} sourceMode="REAL" />);
    expect(screen.getByRole('status').textContent).toContain('less than 60 seconds');
    act(() => vi.advanceTimersByTime(75_000));
    expect(screen.getByRole('status').textContent).toContain('older than 60 seconds');
  });
  it('keeps absent or invalid optional measurements unavailable instead of inventing values', () => {
    render(<DeviceHealthPanel nodeId="A" report={health({ battery_pct: undefined, rssi_dbm: undefined, packet_loss: 2, telemetry_age_sec: NaN, timestamp: 'invalid' })} quality={undefined} error={null} sourceMode="REAL" />);
    expect(screen.getAllByText('Not reported')).toHaveLength(5);
    expect(screen.getByRole('status').textContent).toContain('freshness cannot be established');
    expect(screen.getByText('Signature quality is not available.')).toBeTruthy();
  });
  it('never displays another node’s retained payload and explains query errors', () => {
    const view = render(<DeviceHealthPanel nodeId="B" report={health()} quality={quality} error={null} sourceMode="SIMULATION" />);
    expect(screen.getByText(/Loading device health/)).toBeTruthy();
    expect(screen.queryByText('-73 dBm')).toBeNull();
    view.rerender(<DeviceHealthPanel nodeId="B" report={health()} quality={quality} error={new Error('backend unavailable')} sourceMode="REAL" />);
    expect(screen.getByText(/backend unavailable/)).toBeTruthy();
    expect(screen.getByText('No health report is available for this node.')).toBeTruthy();
  });
});
