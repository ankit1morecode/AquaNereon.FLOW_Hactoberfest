import type { WaterEvent } from '../types';

export interface ReportFilters {
  status: 'session' | 'closed' | 'open';
  startDate: string;
  endDate: string;
}

/** A date input represents a calendar day in the operator's local timezone. */
function localDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function reportFilterError(filters: ReportFilters): string | null {
  if ((filters.startDate && !localDay(filters.startDate)) ||
      (filters.endDate && !localDay(filters.endDate))) return 'Enter valid calendar dates.';
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return 'The start date must be on or before the end date.';
  }
  return null;
}

export function filterReportEvents(events: WaterEvent[], filters: ReportFilters): WaterEvent[] {
  if (reportFilterError(filters)) return [];
  const start = filters.startDate ? localDay(filters.startDate)!.getTime() : -Infinity;
  const endDay = filters.endDate ? localDay(filters.endDate)! : null;
  // Advancing the calendar date handles 23/25-hour daylight-saving days.
  if (endDay) endDay.setDate(endDay.getDate() + 1);
  const endExclusive = endDay?.getTime() ?? Infinity;
  return events.filter((event) => {
    if (filters.status === 'closed' && event.status !== 'CLOSED') return false;
    if (filters.status === 'open' && event.status === 'CLOSED') return false;
    if (!filters.startDate && !filters.endDate) return true;
    const timestamp = new Date(event.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < endExclusive;
  });
}

export function reportStatistics(events: WaterEvent[]) {
  const closed = events.filter((event) => event.status === 'CLOSED');
  const verified = closed.filter((event) => event.verification_id);
  const byType = new Map<WaterEvent['event_type'], number>();
  const byNode = new Map<string, number>();
  for (const event of events) {
    byType.set(event.event_type, (byType.get(event.event_type) ?? 0) + 1);
    byNode.set(event.node_id, (byNode.get(event.node_id) ?? 0) + 1);
  }
  return {
    total: events.length,
    closed: closed.length,
    verified: verified.length,
    intervened: events.filter((event) => event.intervention_id).length,
    byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    byNode: [...byNode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    verificationRate: closed.length > 0 ? verified.length / closed.length : 0,
  };
}
