/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlatformSimulator } from '../src/services/platformSimulator';
import { SimulationControls } from '../src/app/SimulationControls';

const context = vi.hoisted(() => ({ platform: null as PlatformSimulator | null }));
vi.mock('../src/services/ApiProvider', () => ({ usePlatform: () => context.platform }));
afterEach(() => { context.platform?.stop(); context.platform = null; cleanup(); vi.useRealTimers(); });

describe('platform playback', () => {
  it('changes running speed without creating another timer and pauses cleanly', () => {
    vi.useFakeTimers();
    const platform = context.platform = new PlatformSimulator({ timeScale: 6, tickHz: 4 });
    vi.spyOn(platform, 'tick').mockImplementation((dt) => { platform.time += dt; });
    platform.start();
    platform.start();
    vi.advanceTimersByTime(1000);
    expect(platform.time).toBe(6);
    platform.setPlaybackSpeed(12);
    vi.advanceTimersByTime(1000);
    expect(platform.time).toBe(18);
    platform.stop();
    vi.advanceTimersByTime(2000);
    expect(platform.time).toBe(18);
    expect(vi.getTimerCount()).toBe(0);
    platform.start();
    vi.advanceTimersByTime(1000);
    expect(platform.time).toBe(30);
  });
  it('steps the real model only while paused and keeps the current model instance', () => {
    vi.useFakeTimers();
    const platform = context.platform = new PlatformSimulator();
    const node = [...platform.nodes.values()][0];
    expect(platform.stepOnce()).toBe(true);
    expect(platform.time).toBe(1);
    expect([...platform.nodes.values()][0]).toBe(node);
    platform.start();
    expect(platform.stepOnce()).toBe(false);
    expect(platform.time).toBe(1);
  });
  it('rejects clock values that could freeze or destabilize the model', () => {
    const platform = new PlatformSimulator();
    for (const speed of [0, -1, NaN, Infinity, 61]) {
      expect(() => platform.setPlaybackSpeed(speed)).toThrow(RangeError);
    }
    expect(platform.playbackSpeed).toBe(6);
  });
  it('exposes pause/resume, speed and stepping through actual simulator state', () => {
    vi.useFakeTimers();
    const platform = context.platform = new PlatformSimulator();
    render(<SimulationControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Step +1s' }));
    expect(platform.time).toBe(1);
    fireEvent.change(screen.getByLabelText('Simulation speed'), { target: { value: '12' } });
    expect(platform.playbackSpeed).toBe(12);
    fireEvent.click(screen.getByRole('button', { name: 'Resume simulation' }));
    expect(platform.running).toBe(true);
    expect((screen.getByRole('button', { name: 'Step +1s' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pause simulation' }));
    expect(platform.running).toBe(false);
  });
  it('hides simulation actions for a real backend session', () => {
    const { container } = render(<SimulationControls />);
    expect(container.innerHTML).toBe('');
  });
});
