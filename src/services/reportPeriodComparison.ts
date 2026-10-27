import type { WaterEvent } from '../types';
import { filterReportEvents, reportFilterError, type ReportFilters } from './reportFilters';

export const MAX_COMPARISON_DAYS = 366;
export interface CalendarPeriod { startDate: string; endDate: string }
export interface ComparisonPeriods { days: number; current: CalendarPeriod; previous: CalendarPeriod }
export interface PeriodMetric { label: string; current: number; previous: number; difference: number; percentChange: number | null }

/** UTC calendar coordinates avoid treating 23/25-hour local days as fractional days. */
function calendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}
function key(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function comparisonPeriods(filters: ReportFilters): { periods: ComparisonPeriods | null; error: string | null } {
  const invalid = reportFilterError(filters);
  if (invalid) return { periods: null, error: invalid };
  if (!filters.startDate || !filters.endDate) return { periods: null, error: 'Select both report dates to compare with the immediately preceding period.' };
  const start = calendarDate(filters.startDate);
  const end = calendarDate(filters.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400_000) + 1;
  if (days > MAX_COMPARISON_DAYS) return { periods: null, error: `Choose a report range of ${MAX_COMPARISON_DAYS} calendar days or fewer for period comparison.` };
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);
  if (previousStart.getUTCFullYear() < 0) return { periods: null, error: 'The preceding period falls outside the supported calendar range.' };
  return { periods: {
    days, current: { startDate: filters.startDate, endDate: filters.endDate },
    previous: { startDate: key(previousStart), endDate: key(previousEnd) },
  }, error: null };
}

function counts(events: WaterEvent[]): number[] {
  return [events.length, events.filter((event) => event.severity === 'HIGH' || event.severity === 'CRITICAL').length,
    events.filter((event) => event.status === 'CLOSED').length,
    events.filter((event) => event.status === 'CLOSED' && Boolean(event.verification_id)).length];
}

/** Group by incident-raised date; statuses and verification are their current reported values. */
export function compareReportPeriods(events: WaterEvent[], filters: ReportFilters) {
  const range = comparisonPeriods(filters);
  if (!range.periods) return { ...range, metrics: [] as PeriodMetric[] };
  const current = counts(filterReportEvents(events, { ...filters, ...range.periods.current }));
  const previous = counts(filterReportEvents(events, { ...filters, ...range.periods.previous }));
  const labels = ['Incidents raised', 'High or critical incidents', 'Currently closed incidents', 'Closed with verification reference'];
  return { ...range, metrics: labels.map((label, index): PeriodMetric => ({
    label, current: current[index], previous: previous[index], difference: current[index] - previous[index],
    percentChange: previous[index] > 0 ? (current[index] - previous[index]) / previous[index] * 100 : null,
  })) };
}
