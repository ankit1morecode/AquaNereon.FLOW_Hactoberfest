import { useSyncExternalStore } from 'react';

export const EVENT_BOOKMARKS_KEY = 'aquanereon.event-bookmarks.v1';
export const MAX_EVENT_BOOKMARKS = 1000;
type BookmarkStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface BookmarkSnapshot { ids: string[]; persisted: boolean; warning: string | null }
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200;

export function parseEventBookmarks(raw: string | null): string[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('ids' in value) || !Array.isArray(value.ids)) throw new Error('Invalid bookmarks');
  return [...new Set(value.ids.filter(validId))].slice(0, MAX_EVENT_BOOKMARKS);
}

/** Local preferences stay separate from incident records and backend status. */
export function createEventBookmarks(getStorage: () => BookmarkStorage = () => window.localStorage) {
  let snapshot: BookmarkSnapshot | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): BookmarkSnapshot => {
    if (!snapshot) {
      try { snapshot = { ids: parseEventBookmarks(getStorage().getItem(EVENT_BOOKMARKS_KEY)), persisted: true, warning: null }; }
      catch { snapshot = { ids: [], persisted: false, warning: 'Saved bookmarks could not be read. New bookmarks are kept for this session.' }; }
    }
    return snapshot;
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    toggle(id: string): string | null {
      const current = getSnapshot();
      if (!validId(id)) return 'This event has an invalid identifier.';
      const exists = current.ids.includes(id);
      if (!exists && current.ids.length >= MAX_EVENT_BOOKMARKS) return `You can keep up to ${MAX_EVENT_BOOKMARKS} bookmarks. Remove one before adding another.`;
      const ids = exists ? current.ids.filter((value) => value !== id) : [...current.ids, id];
      let persisted = false;
      try { getStorage().setItem(EVENT_BOOKMARKS_KEY, JSON.stringify({ version: 1, ids })); persisted = true; } catch { /* Keep bookmarks available across route remounts in this session. */ }
      snapshot = { ids, persisted, warning: persisted ? null : 'Browser storage is unavailable. Bookmarks are kept for this session.' };
      for (const listener of listeners) listener();
      return null;
    },
  };
}
export const eventBookmarks = createEventBookmarks();
export function useEventBookmarks() {
  const snapshot = useSyncExternalStore(eventBookmarks.subscribe, eventBookmarks.getSnapshot);
  return { ...snapshot, toggle: eventBookmarks.toggle };
}
