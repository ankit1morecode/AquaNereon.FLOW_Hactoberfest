/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { NetworkGraph } from '../src/types';
import { mappableTrace, traceTopology } from '../src/services/topologyTrace';
import { NetworkInventory } from '../src/pages/NetworkInventory';
const data = vi.hoisted(() => ({ graph: null as NetworkGraph | null }));
vi.mock('../src/services/ApiProvider', () => ({ useQuery: (fetcher: (client: object) => unknown) => ({ data: fetcher({ getNetwork: () => data.graph, getNodes: () => [] }), error: null }) }));
vi.mock('../src/components/NetworkMap', () => ({ NetworkMap: ({ network }: { network: NetworkGraph }) => <div data-testid="trace-map">{network.vertices.map((vertex) => vertex.id).join(',')}</div> }));
const graph: NetworkGraph = {
  vertices: ['SOURCE', 'A', 'B', 'SIBLING', 'ISOLATED'].map((id, index) => ({ id, kind: id === 'SOURCE' ? 'RESERVOIR' : 'JUNCTION', zone_id: 'Z', location: { lat: 54 + index * 0.01, lng: -1, label: id } })),
  zones: [{ zone_id: 'Z', name: 'Zone', population: 1000, node_ids: ['A', 'B', 'SIBLING', 'ISOLATED'] }],
  edges: [['SOURCE', 'A'], ['A', 'B'], ['B', 'A'], ['SOURCE', 'SIBLING'], ['MISSING', 'A']].map(([from, to], index) => ({ pipe_id: `P${index}`, from, to, diameter_mm: 200, length_m: 100, nominal_flow_lps: 20, nominal_pressure_kpa: 300 })),
};
afterEach(cleanup);
function Location() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="trace-url">{location.search}</output><button onClick={() => navigate('/network?trace=SOURCE&direction=downstream')}>Open source trace</button></>; }
function setup(entry = '/network') { data.graph = graph; return render(<MemoryRouter initialEntries={[entry]}><NetworkInventory /><Location /></MemoryRouter>); }
describe('structural topology trace', () => {
  it('uses declared directions and safely walks cycles without including upstream branch siblings', () => {
    const downstream = traceTopology(graph, 'A', 'downstream');
    expect(downstream.network.vertices.map((vertex) => vertex.id)).toEqual(['A', 'B']);
    expect(downstream.network.edges.map((edge) => edge.pipe_id)).toEqual(['P1', 'P2']);
    for (const direction of ['upstream', 'both'] as const) {
      expect(traceTopology(graph, 'A', direction).network.vertices.map((vertex) => vertex.id)).toEqual(['SOURCE', 'A', 'B']);
    }
    expect(traceTopology(graph, 'SOURCE', 'downstream').network.vertices.map((vertex) => vertex.id)).toEqual(['SOURCE', 'A', 'B', 'SIBLING']);
    expect(downstream.omittedEdges).toBe(1);
    expect(graph.edges).toHaveLength(5);
  });
  it('retains isolated assets, reports missing selections, and omits bad coordinates only from the map', () => {
    const isolated = traceTopology(graph, 'ISOLATED', 'both');
    expect(isolated.found).toBe(true); expect(isolated.network.vertices).toHaveLength(1); expect(isolated.network.edges).toEqual([]);
    expect(traceTopology(graph, 'UNKNOWN', 'upstream').found).toBe(false);
    const invalid = { ...graph, vertices: graph.vertices.map((vertex) => vertex.id === 'A' ? { ...vertex, location: { ...vertex.location, lat: NaN } } : vertex) };
    const traced = traceTopology(invalid, 'A', 'downstream');
    expect(traced.network.vertices).toHaveLength(2);
    expect(mappableTrace(traced.network).vertices.map((vertex) => vertex.id)).toEqual(['B']);
    expect(mappableTrace(traced.network).edges).toEqual([]);
  });
  it('preserves batched pipe and trace URL changes and clears each scope independently', () => {
    setup();
    act(() => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search pipes' }), { target: { value: 'P1' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Trace from asset' }), { target: { value: 'A' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Trace direction' }), { target: { value: 'upstream' } });
    });
    const params = new URLSearchParams(screen.getByTestId('trace-url').textContent ?? '');
    expect(params.get('q')).toBe('P1'); expect(params.get('trace')).toBe('A'); expect(params.get('direction')).toBe('upstream');
    expect(screen.getByTestId('trace-map').textContent).toBe('SOURCE,A,B');
    fireEvent.click(screen.getByRole('button', { name: 'Clear pipe filters' }));
    expect(screen.getByTestId('trace-url').textContent).toContain('trace=A');
    expect(screen.getByRole('searchbox', { name: 'Search pipes' }).getAttribute('value')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Clear trace' }));
    expect(screen.getByTestId('trace-url').textContent).toBe('');
  });
  it('loads URL selections, responds to navigation and explains unavailable or isolated assets', () => {
    setup('/network?trace=UNKNOWN');
    expect(screen.getByText(/selected asset is absent/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open source trace' }));
    expect(screen.getByTestId('trace-map').textContent).toBe('SOURCE,A,B,SIBLING');
    fireEvent.change(screen.getByRole('combobox', { name: 'Trace from asset' }), { target: { value: 'ISOLATED' } });
    expect(screen.getByText(/No pipes are connected in this direction/)).toBeTruthy();
    expect(screen.getByTestId('trace-map').textContent).toBe('ISOLATED');
  });
});
