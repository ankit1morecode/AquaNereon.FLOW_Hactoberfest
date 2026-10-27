/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describeFeed } from '../src/services/feedStatus';
import { DataFeedStatus } from '../src/app/DataFeedStatus';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const base = { mode: 'REAL' as const, online: true, updatedAt: 1000, error: null, now: 2000 };

describe('feed status', () => {
  it('distinguishes connecting, stale reads, offline and failed refreshes', () => {
    expect(describeFeed({ ...base, updatedAt: null }).tone).toBe('pending');
    expect(describeFeed(base).label).toBe('Data refreshed just now');
    expect(describeFeed({ ...base, now: 62000 }).tone).toBe('warn');
    expect(describeFeed({ ...base, online: false }).label).toBe('Browser offline');
    expect(describeFeed({ ...base, error: new Error('Failed') }).label).toBe('Refresh failed');
    expect(describeFeed({ ...base, updatedAt: null, error: new Error('Failed') }).label).toBe('Feed unavailable');
  });
  it('keeps a paused browser simulation available when the browser goes offline', () => {
    expect(describeFeed({ ...base, mode: 'SIMULATION', online: false, now: 1e9 }).label).toBe('Simulation feed');
  });
  it('refreshes on demand and reconnect, and disables real requests while offline', () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    const refresh = vi.fn();
    render(<DataFeedStatus mode="REAL" updatedAt={Date.now()} error={null} refreshing={false} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    onLine.mockReturnValue(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status').textContent).toBe('Browser offline');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    onLine.mockReturnValue(true);
    fireEvent(window, new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
