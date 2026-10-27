import { useEffect, useState } from 'react';

export const WATCHLIST_KEY = 'aquanereon.watchlist.v1';
const WATCHLIST_CHANGED = 'aquanereon:watchlist';
type WatchlistStorage = Pick<Storage, 'getItem' | 'setItem'>;
let sessionWatchlist: string[] = [];
let sessionOnly = false;

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128))].slice(0, 1000);
}

export function readWatchlist(storage?: WatchlistStorage): string[] {
  if (!storage && sessionOnly) return [...sessionWatchlist];
  try {
    const raw = (storage ?? window.localStorage).getItem(WATCHLIST_KEY);
    const ids = raw ? cleanIds(JSON.parse(raw)) : [];
    sessionWatchlist = ids;
    return ids;
  } catch {
    return [...sessionWatchlist];
  }
}

export function saveWatchlist(ids: string[], storage?: WatchlistStorage): boolean {
  sessionWatchlist = cleanIds(ids);
  try {
    (storage ?? window.localStorage).setItem(WATCHLIST_KEY, JSON.stringify(sessionWatchlist));
    sessionOnly = false;
    return true;
  } catch {
    sessionOnly = true;
    return false;
  }
}

export function useWatchlist() {
  const [ids, setIds] = useState(readWatchlist);
  const [persisted, setPersisted] = useState(!sessionOnly);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WATCHLIST_KEY || event.key === null) setIds(readWatchlist());
    };
    const onChange = () => setIds([...sessionWatchlist]);
    window.addEventListener('storage', onStorage);
    window.addEventListener(WATCHLIST_CHANGED, onChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WATCHLIST_CHANGED, onChange);
    };
  }, []);
  return {
    ids,
    persisted,
    toggle(id: string) {
      const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
      setIds(next);
      setPersisted(saveWatchlist(next));
      window.dispatchEvent(new Event(WATCHLIST_CHANGED));
    },
  };
}
