import type { WaterEvent } from '../types';

export const ALERT_INBOX_KEY = 'aquanereon.alert-inbox.v1';
export const INBOX_MODES = ['important', 'all', 'watchlist'] as const;
export type InboxMode = typeof INBOX_MODES[number];
export interface InboxPreferences { mode: InboxMode; read: string[] }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

function cleanPreferences(value: unknown): InboxPreferences {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    mode: INBOX_MODES.includes(record.mode as InboxMode) ? record.mode as InboxMode : 'important',
    read: Array.isArray(record.read) ? [...new Set(record.read.filter((id): id is string =>
      typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, 1000) : [],
  };
}

/** Session memory keeps inbox preferences usable when browser storage is denied. */
export function createInboxPreferences(storage: () => StoragePort = () => window.localStorage) {
  let session: InboxPreferences = { mode: 'important', read: [] };
  let sessionOnly = false;
  const copy = () => ({ mode: session.mode, read: [...session.read] });
  return {
    read() {
      if (!sessionOnly) {
        try {
          const raw = storage().getItem(ALERT_INBOX_KEY);
          const parsed: unknown = raw ? JSON.parse(raw) : { version: 1 };
          if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) throw new Error('Unsupported inbox preferences');
          session = cleanPreferences(parsed);
        } catch { sessionOnly = true; }
      }
      return { preferences: copy(), persisted: !sessionOnly };
    },
    write(value: InboxPreferences) {
      session = cleanPreferences(value);
      try {
        storage().setItem(ALERT_INBOX_KEY, JSON.stringify({ version: 1, ...session }));
        sessionOnly = false;
      } catch { sessionOnly = true; }
      return { preferences: copy(), persisted: !sessionOnly };
    },
  };
}

export const alertInboxPreferences = createInboxPreferences();

export function inboxEvents(events: WaterEvent[], mode: InboxMode, watched: string[]): WaterEvent[] {
  const priority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  return events.filter((event) => event.status !== 'CLOSED' && (
    mode === 'all' || (mode === 'watchlist' ? watched.includes(event.node_id)
      : event.severity === 'CRITICAL' || event.severity === 'HIGH' || watched.includes(event.node_id))
  )).sort((a, b) => priority.indexOf(a.severity) - priority.indexOf(b.severity)
    || (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
    || a.event_id.localeCompare(b.event_id));
}

export function markInboxRead(preferences: InboxPreferences, ids: string[]): InboxPreferences {
  return { ...preferences, read: [...new Set([...ids, ...preferences.read])].slice(0, 1000) };
}
