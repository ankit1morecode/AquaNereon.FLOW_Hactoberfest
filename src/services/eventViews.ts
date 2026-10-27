import { readEventFilters, type EventFilters } from './eventFilters';

export const EVENT_VIEWS_KEY = 'aquanereon.event-views.v1';
export const MAX_EVENT_VIEWS = 12;
export interface SavedEventView { id: string; name: string; filters: EventFilters }
export interface EventViewRead { views: SavedEventView[]; error: string | null }

export function readEventViews(storage: Pick<Storage, 'getItem'>): EventViewRead {
  try {
    const raw = storage.getItem(EVENT_VIEWS_KEY);
    if (!raw) return { views: [], error: null };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('views' in data) || !Array.isArray(data.views)) throw new Error('Invalid saved views');
    const ids = new Set<string>();
    const views: SavedEventView[] = [];
    for (const item of data.views.slice(0, MAX_EVENT_VIEWS)) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id)
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || !item.filters || typeof item.filters !== 'object') continue;
      const values = item.filters as Record<string, unknown>;
      if (['q', 'severity', 'status', 'zone', 'sort'].some((key) => typeof values[key] !== 'string')) continue;
      const params = new URLSearchParams();
      for (const key of ['q', 'severity', 'status', 'zone', 'sort']) params.set(key, values[key] as string);
      views.push({ id: item.id, name: item.name.trim(), filters: readEventFilters(params) });
      ids.add(item.id);
    }
    return { views, error: null };
  } catch {
    return { views: [], error: 'Saved views could not be read. You can still filter events and save views for this session.' };
  }
}

export function writeEventViews(storage: Pick<Storage, 'setItem'>, views: SavedEventView[]): boolean {
  try {
    storage.setItem(EVENT_VIEWS_KEY, JSON.stringify({ version: 1, views: views.slice(0, MAX_EVENT_VIEWS) }));
    return true;
  } catch { return false; }
}
