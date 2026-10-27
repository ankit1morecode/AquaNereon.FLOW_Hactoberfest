/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readWatchlist, saveWatchlist, useWatchlist, WATCHLIST_KEY } from '../src/services/watchlist';

beforeEach(() => { localStorage.clear(); saveWatchlist([]); });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('persistent node watchlist', () => {
  it('round-trips unique IDs and rejects malformed stored data', () => {
    expect(saveWatchlist(['AN-J-014', 'AN-J-014', 'AN-J-018'])).toBe(true);
    expect(readWatchlist()).toEqual(['AN-J-014', 'AN-J-018']);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(['AN-J-014', 42, null, '']));
    expect(readWatchlist()).toEqual(['AN-J-014']);
    localStorage.setItem(WATCHLIST_KEY, '{}');
    expect(readWatchlist()).toEqual([]);
  });
  it('keeps a usable session watchlist when storage access fails', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(saveWatchlist(['AN-J-014'], blocked)).toBe(false);
    expect(readWatchlist(blocked)).toEqual(['AN-J-014']);
  });
  it('does not overwrite a session edit with older disk data after a quota failure', () => {
    saveWatchlist(['AN-J-014']);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveWatchlist(['AN-J-018'])).toBe(false);
    expect(readWatchlist()).toEqual(['AN-J-018']);
  });
  it('updates multiple consumers and restores after remount', () => {
    function Consumer({ name }: { name: string }) {
      const watchlist = useWatchlist();
      return <button onClick={() => watchlist.toggle('AN-J-014')}>{name}: {watchlist.ids.join(',') || 'empty'}</button>;
    }
    const view = render(<><Consumer name="first" /><Consumer name="second" /></>);
    fireEvent.click(screen.getByRole('button', { name: 'first: empty' }));
    expect(screen.getByRole('button', { name: 'second: AN-J-014' })).toBeTruthy();
    view.unmount();
    render(<Consumer name="restored" />);
    expect(screen.getByRole('button', { name: 'restored: AN-J-014' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'restored: AN-J-014' }));
    expect(readWatchlist()).toEqual([]);
  });
});
