import type { WaterEvent } from '../types';

export const REPORT_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export interface CountBucket { label: string; count: number }

/** A timestamp belongs to the operator's local calendar day. */
export function reportDayKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Consume the same already-filtered events as the report KPIs and exports. */
export function incidentAnalytics(events: WaterEvent[]) {
  const severity = new Map<string, number>(REPORT_SEVERITIES.map((label) => [label, 0]));
  const zones = new Map<string, number>();
  const days = new Map<string, number>();
  let invalidTimestamps = 0;
  for (const event of events) {
    const level = REPORT_SEVERITIES.includes(event.severity) ? event.severity : 'Not reported';
    severity.set(level, (severity.get(level) ?? 0) + 1);
    const zone = event.zone_id || 'Not reported';
    zones.set(zone, (zones.get(zone) ?? 0) + 1);
    const day = reportDayKey(event.timestamp);
    if (day) days.set(day, (days.get(day) ?? 0) + 1);
    else invalidTimestamps++;
  }
  return {
    total: events.length,
    severity: [...severity].map(([label, count]) => ({ label, count })),
    zones: [...zones].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    days: [...days].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    invalidTimestamps,
  };
}
