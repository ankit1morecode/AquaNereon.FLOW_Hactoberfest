/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ZoneSummary } from '../src/types';
import { filterZones, zoneMargin } from '../src/services/zoneOverview';
import { ZoneOverview } from '../src/pages/ZoneOverview';

const query = vi.hoisted(() => ({ data: undefined as ZoneSummary[] | undefined, error: null as Error | null }));
vi.mock('../src/services/ApiProvider', () => ({ useQuery: () => query }));
function zone(id: string, name: string, over: Partial<ZoneSummary> = {}): ZoneSummary {
  return { zone_id: id, name, population: 1000, node_ids: ['node-one'], supply_lps: 120, demand_lps: 100,
    loss_fraction: 0.1, shortage_risk: 0.2, open_events: 2, worst_state: 'STABLE', forecast_peak_lps: 130, consumption_series: [], ...over };
}
const zones = [zone('Z-NORTH', 'North'), zone('Z-SOUTH', 'South', { demand_lps: 140, shortage_risk: 0.5, loss_fraction: 0.3 })];
function Location() { return <output data-testid="zone-url">{useLocation().search}</output>; }
beforeEach(() => { query.data = zones; query.error = null; });
afterEach(cleanup);
const setup = (entry = '/zones') => render(<MemoryRouter initialEntries={[entry]}><ZoneOverview /><Location /></MemoryRouter>);

describe('zone overview', () => {
  it('filters by zone ID or name without mutating the source and ranks actual values', () => {
    expect(filterZones(zones, new URLSearchParams('q=south')).map((z) => z.zone_id)).toEqual(['Z-SOUTH']);
    for (const sort of ['demand', 'shortage', 'loss']) expect(filterZones(zones, new URLSearchParams(`sort=${sort}`))[0].zone_id).toBe('Z-SOUTH');
    expect(filterZones(zones, new URLSearchParams('sort=margin'))[0].zone_id).toBe('Z-NORTH');
    expect(zones[0].zone_id).toBe('Z-NORTH');
    expect(zoneMargin(zones[1])).toBe(-20);
    expect(zoneMargin({ supply_lps: NaN, demand_lps: 10 })).toBeNull();
  });
  it('preserves rapid query edits and clears them together', () => {
    setup();
    act(() => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search zones' }), { target: { value: 'North' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort zones' }), { target: { value: 'loss' } });
    });
    const params = new URLSearchParams(screen.getByTestId('zone-url').textContent ?? '');
    expect(params.get('q')).toBe('North'); expect(params.get('sort')).toBe('loss');
    expect(screen.queryByRole('link', { name: 'South' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('zone-url').textContent).toBe('');
    expect(screen.getByRole('link', { name: 'South' })).toBeTruthy();
  });
  it('links to the actual zone, its nodes and its filtered events', () => {
    setup('/zones?q=Z-SOUTH');
    expect(screen.getByRole('link', { name: 'South' }).getAttribute('href')).toBe('/zones/Z-SOUTH');
    expect(screen.getByRole('link', { name: 'Nodes (1)' }).getAttribute('href')).toBe('/nodes?zone=Z-SOUTH');
    expect(screen.getByRole('link', { name: 'Events (2 open)' }).getAttribute('href')).toBe('/events?zone=Z-SOUTH');
    expect(screen.getByText('-20.0')).toBeTruthy();
  });
  it('handles loading, empty responses and API errors', () => {
    query.data = undefined; const view = setup(); expect(screen.getByText(/Loading zones/)).toBeTruthy();
    query.data = []; view.rerender(<MemoryRouter><ZoneOverview /></MemoryRouter>); expect(screen.getByText('No zones are available.')).toBeTruthy();
    query.error = new Error('Backend unavailable'); view.rerender(<MemoryRouter><ZoneOverview /></MemoryRouter>); expect(screen.getByText(/Backend unavailable/)).toBeTruthy();
  });
});
