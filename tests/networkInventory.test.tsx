/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { NetworkGraph } from '../src/types';
import { filterPipeAssets, inventoryLength, pipeAssets } from '../src/services/networkInventory';
import { NetworkInventory } from '../src/pages/NetworkInventory';
const query = vi.hoisted(() => ({ data: undefined as NetworkGraph | undefined, error: null as Error | null }));
vi.mock('../src/services/ApiProvider', () => ({ useQuery: (fetcher: (client: object) => unknown) => ({ ...query, data: fetcher({ getNetwork: () => query.data, getNodes: () => [] }) }) }));
vi.mock('../src/components/NetworkMap', () => ({ NetworkMap: () => <div>Topology map</div> }));
const graph: NetworkGraph = {
  vertices: [
    { id: 'SOURCE', kind: 'RESERVOIR', zone_id: 'north', location: { lat: 54, lng: -1, label: 'Hill reservoir', address: 'Hill Road' } },
    { id: 'NODE-A', kind: 'JUNCTION', zone_id: 'north', location: { lat: 54.01, lng: -1, label: 'Exchange' } },
    { id: 'NODE-B', kind: 'JUNCTION', zone_id: 'south', location: { lat: 54.02, lng: -1, label: 'Dock' } },
  ],
  zones: [{ zone_id: 'north', name: 'Northside', population: 1000, node_ids: ['NODE-A'] }, { zone_id: 'south', name: 'Southside', population: 1000, node_ids: ['NODE-B'] }],
  edges: [
    { pipe_id: 'P-1', from: 'SOURCE', to: 'NODE-A', length_m: 500, diameter_mm: 300, nominal_flow_lps: 40, nominal_pressure_kpa: 310 },
    { pipe_id: 'P-2', from: 'NODE-A', to: 'NODE-B', length_m: 900, diameter_mm: 250, nominal_flow_lps: 30, nominal_pressure_kpa: 300 },
    { pipe_id: 'P-3', from: 'missing', to: 'NODE-B', length_m: NaN, diameter_mm: 200, nominal_flow_lps: 20, nominal_pressure_kpa: 300 },
  ],
};
beforeEach(() => { query.data = graph; query.error = null; });
afterEach(cleanup);
function Location() { return <output data-testid="inventory-url">{useLocation().search}</output>; }
const setup = (entry = '/network') => render(<MemoryRouter initialEntries={[entry]}><NetworkInventory /><Location /></MemoryRouter>);
describe('pipe inventory', () => {
  it('joins endpoints and searches addresses/zones while matching either cross-zone endpoint', () => {
    const assets = pipeAssets(graph);
    expect(filterPipeAssets(assets, new URLSearchParams('q=Hill Road')).map((asset) => asset.pipe.pipe_id)).toEqual(['P-1']);
    expect(filterPipeAssets(assets, new URLSearchParams('zone=south')).map((asset) => asset.pipe.pipe_id)).toEqual(['P-2', 'P-3']);
    expect(filterPipeAssets(assets, new URLSearchParams('q=Southside')).length).toBe(2);
    expect(inventoryLength(assets)).toEqual({ metres: 1400, measured: 2 });
    expect(assets[2].from).toBeUndefined();
  });
  it('sorts real dimensions without mutating the network or ranking invalid lengths first', () => {
    const assets = pipeAssets(graph);
    expect(filterPipeAssets(assets, new URLSearchParams('sort=length')).map((asset) => asset.pipe.pipe_id)).toEqual(['P-2', 'P-1', 'P-3']);
    expect(filterPipeAssets(assets, new URLSearchParams('sort=diameter'))[0].pipe.pipe_id).toBe('P-1');
    expect(filterPipeAssets(assets, new URLSearchParams('sort=flow'))[0].pipe.pipe_id).toBe('P-1');
    expect(assets[0].pipe.pipe_id).toBe('P-1');
  });
  it('preserves rapid URL filter changes, displays specifications and navigates to junctions only', () => {
    setup();
    act(() => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search pipes' }), { target: { value: 'Dock' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort pipes' }), { target: { value: 'length' } });
    });
    const params = new URLSearchParams(screen.getByTestId('inventory-url').textContent ?? '');
    expect(params.get('q')).toBe('Dock'); expect(params.get('sort')).toBe('length');
    expect(screen.queryByRole('rowheader', { name: 'P-1' })).toBeNull();
    const row = screen.getByRole('rowheader', { name: 'P-2' }).closest('tr')!;
    expect(within(row).getByRole('link', { name: 'NODE-A' }).getAttribute('href')).toBe('/nodes/NODE-A');
    expect(within(row).getByRole('link', { name: 'Southside' }).getAttribute('href')).toBe('/zones/south');
    fireEvent.click(screen.getByRole('button', { name: 'Clear pipe filters' }));
    expect(screen.getByTestId('inventory-url').textContent).toBe('');
    expect(screen.queryByRole('link', { name: 'SOURCE' })).toBeNull();
    expect(screen.getByText('Hill reservoir')).toBeTruthy();
  });
  it('handles empty/loading/error data and keeps cached specifications with a refresh warning', () => {
    query.data = undefined; const view = setup(); expect(screen.getByText(/Loading pipe inventory/)).toBeTruthy();
    query.error = new Error('Unavailable'); view.rerender(<MemoryRouter><NetworkInventory /></MemoryRouter>); expect(screen.getByText(/Unavailable/)).toBeTruthy();
    query.data = { vertices: [], edges: [], zones: [] }; query.error = null;
    view.rerender(<MemoryRouter><NetworkInventory /></MemoryRouter>); expect(screen.getByText('No pipes are available in the loaded network.')).toBeTruthy();
    query.data = graph; query.error = new Error('Refresh failed'); view.rerender(<MemoryRouter><NetworkInventory /></MemoryRouter>);
    expect(screen.getByRole('rowheader', { name: 'P-1' })).toBeTruthy(); expect(screen.getByText(/Refresh failed/)).toBeTruthy();
  });
});
