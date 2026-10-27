import type { Severity, WaterEvent } from '../types';

export const EVENT_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
export const EVENT_STATUSES: WaterEvent['status'][] = [
  'OPEN', 'ACKNOWLEDGED', 'INTERVENING', 'VERIFYING', 'CLOSED',
];
export const EVENT_SORTS = ['priority', 'newest', 'oldest', 'anomaly'] as const;
export type EventSort = (typeof EVENT_SORTS)[number];
export interface EventFilters {
  q: string;
  severity: Severity | '';
  status: WaterEvent['status'] | '';
  zone: string;
  sort: EventSort;
}

export function readEventFilters(params: URLSearchParams): EventFilters {
  const severity = params.get('severity') ?? '';
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, 200),
    severity: EVENT_SEVERITIES.includes(severity as Severity) ? severity as Severity : '',
    status: EVENT_STATUSES.includes(status as WaterEvent['status']) ? status as WaterEvent['status'] : '',
    zone: (params.get('zone') ?? '').slice(0, 120),
    sort: EVENT_SORTS.includes(sort as EventSort) ? sort as EventSort : 'priority',
  };
}

/** Preserve unrelated URL state while dropping a selection hidden by a changed filter. */
export function writeEventFilters(params: URLSearchParams, changes: Partial<EventFilters>): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || (key === 'sort' && value === 'priority')) next.delete(key);
    else next.set(key, value);
  }
  next.delete('event');
  return next;
}

export function filterEvents(events: WaterEvent[], filters: EventFilters): WaterEvent[] {
  const query = filters.q.trim().toLocaleLowerCase();
  return events.filter((event) => {
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.status && event.status !== filters.status) return false;
    if (filters.zone && event.zone_id !== filters.zone) return false;
    if (!query) return true;
    const text = [event.event_id, event.node_id, event.zone_id, event.event_type.replace(/_/g, ' '),
      event.severity, event.status, event.suspected_origin?.description,
      event.recommended_action?.action, ...event.evidence.flatMap((item) => [item.label, item.value, item.detail])];
    return text.join(' ').toLocaleLowerCase().includes(query);
  }).sort((a, b) => {
    const time = (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0);
    if (filters.sort === 'oldest') return time || a.event_id.localeCompare(b.event_id);
    if (filters.sort === 'newest') return -time || a.event_id.localeCompare(b.event_id);
    if (filters.sort === 'anomaly') return b.anomaly_score - a.anomaly_score || -time || a.event_id.localeCompare(b.event_id);
    return Number(b.status !== 'CLOSED') - Number(a.status !== 'CLOSED')
      || EVENT_SEVERITIES.indexOf(a.severity) - EVENT_SEVERITIES.indexOf(b.severity)
      || -time || a.event_id.localeCompare(b.event_id);
  });
}
