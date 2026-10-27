/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiProvider } from '../src/services/ApiProvider';
import { NodeComparison } from '../src/pages/NodeComparison';
import { NodeDirectory } from '../src/pages/NodeDirectory';
import { comparisonIds, comparisonUrl, designUtilization, signedDifference } from '../src/pages/NodeComparison/comparison';

afterEach(cleanup);

describe('node comparison', () => {
  it('keeps URL order, removes duplicate nodes and caps comparisons at three', () => {
    const params = new URLSearchParams('node=A&node=A&node=B&node=&node=C&node=D');
    expect(comparisonIds(params)).toEqual(['A', 'B', 'C']);
    expect(comparisonUrl(['A', 'A', 'B'])).toBe('/compare?node=A&node=B');
  });
  it('reports signed physical differences and avoids dividing by zero design flow', () => {
    expect(signedDifference(25, 20)).toBe('+5.0');
    expect(signedDifference(15, 20)).toBe('-5.0');
    expect(designUtilization(25, 50)).toBe(50);
    expect(designUtilization(25, 0)).toBeNull();
  });
  it('loads shareable live selections and clears them through the controls', async () => {
    render(<MemoryRouter initialEntries={['/compare?node=AN-J-002&node=AN-J-005']}><ApiProvider><NodeComparison /></ApiProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'AN-J-002' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'AN-J-005' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Flow difference (L/s)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear comparison' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/Select at least two nodes/)).toBeTruthy();
  });
  it('explains unavailable nodes rather than silently replacing them', async () => {
    render(<MemoryRouter initialEntries={['/compare?node=missing']}><ApiProvider><NodeComparison /></ApiProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Unavailable nodes: missing'));
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('limits directory selection to three and opens those nodes in comparison', async () => {
    render(<MemoryRouter initialEntries={['/nodes?zone=Z-NORTH']}><ApiProvider><Routes><Route path="/nodes" element={<NodeDirectory />} /><Route path="/compare" element={<NodeComparison />} /></Routes></ApiProvider></MemoryRouter>);
    const checkboxes = await screen.findAllByRole('checkbox', { name: /^Compare AN-J-/ });
    expect(checkboxes).toHaveLength(4);
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(checkboxes[3].hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected (3/3)' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Compare nodes' })).toBeTruthy());
    expect(screen.getByRole('table').querySelectorAll('thead th')).toHaveLength(4);
  });
});
