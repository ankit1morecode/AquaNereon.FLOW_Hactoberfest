/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { NodeDirectory } from '../src/pages/NodeDirectory';
import { PlatformSimulator } from '../src/services/platformSimulator';
import { SimulatedApiClient } from '../src/services/simulatedClient';
import type { NodeSummary } from '../src/types';

const fixtures = vi.hoisted(() => ({ nodes: [] as NodeSummary[] }));
vi.mock('../src/services/ApiProvider', () => ({
  useQuery: (fetcher: (client: object) => unknown) => ({ data: fetcher({
    getNodes: () => fixtures.nodes, getZones: () => [],
  }), error: null, loading: false }),
}));

const originalNodes = (await new SimulatedApiClient(new PlatformSimulator()).getNodes()).slice(0, 4);
function Location() { return <output data-testid="directory-location">{useLocation().search}</output>; }
const directory = () => <MemoryRouter><NodeDirectory /><Location /></MemoryRouter>;
beforeEach(() => { fixtures.nodes = [...originalNodes]; localStorage.clear(); });
afterEach(cleanup);

describe('directory comparison selection', () => {
  it('retains batched URL edits and does not restore cleared filters', () => {
    render(directory());
    act(() => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes' }), { target: { value: 'AN-J-002' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'flow' } });
    });
    const search = new URLSearchParams(screen.getByTestId('directory-location').textContent ?? '');
    expect(search.get('q')).toBe('AN-J-002');
    expect(search.get('sort')).toBe('flow');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'anomaly' } });
    });
    const cleared = new URLSearchParams(screen.getByTestId('directory-location').textContent ?? '');
    expect(cleared.get('q')).toBeNull();
    expect(cleared.get('sort')).toBe('anomaly');
  });
  it('keeps selections hidden by filters and lets the operator clear them', () => {
    render(directory());
    originalNodes.slice(0, 3).forEach((node) => fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${node.node_id}` })));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes' }), { target: { value: originalNodes[3].node_id } });
    expect(screen.getByRole('button', { name: 'Compare selected (3/3)' })).toBeTruthy();
    const visible = screen.getByRole('checkbox', { name: `Compare ${originalNodes[3].node_id}` });
    expect(visible.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected' }));
    expect(screen.getByRole('button', { name: 'Compare selected (0/3)' })).toBeTruthy();
    expect(visible.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Clear selected' })).toBeNull();
  });
  it('drops nodes removed from the loaded dataset while retaining valid hidden selections', () => {
    const view = render(directory());
    originalNodes.slice(0, 3).forEach((node) => fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${node.node_id}` })));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes' }), { target: { value: originalNodes[3].node_id } });
    fixtures.nodes = originalNodes.slice(1);
    view.rerender(directory());
    expect(screen.getByRole('button', { name: 'Compare selected (2/3)' })).toBeTruthy();
    const visible = screen.getByRole('checkbox', { name: `Compare ${originalNodes[3].node_id}` });
    expect(visible.hasAttribute('disabled')).toBe(false);
    fireEvent.click(visible);
    expect(screen.getByRole('button', { name: 'Compare selected (3/3)' })).toBeTruthy();
    fixtures.nodes = [];
    view.rerender(directory());
    expect(screen.getByRole('button', { name: 'Compare selected (0/3)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear selected' })).toBeNull();
  });
});
