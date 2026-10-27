/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Events } from '../src/pages/Events';

const api = vi.hoisted(() => ({
  getEvents: () => ({ items: [], total: 0, offset: 0, limit: 200 }),
  getRecommendations: () => [],
  getNetwork: () => ({ zones: [] }),
  getNodes: () => [],
}));
vi.mock('../src/services/ApiProvider', () => ({
  useApi: () => api,
  usePlatform: () => null,
  useQuery: (fetcher: (client: typeof api) => unknown) => ({ data: fetcher(api), error: null, loading: false }),
}));
afterEach(cleanup);
function Location() { return <div data-testid="event-location">{useLocation().search}</div>; }
function setup(entry = '/events') {
  render(<MemoryRouter initialEntries={[entry]}><Events /><Location /></MemoryRouter>);
}

describe('event query controls', () => {
  it('retains edits to several controls before a router navigation renders', () => {
    setup();
    act(() => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), { target: { value: 'AN-J-014' } });
      fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'OPEN' } });
      fireEvent.change(screen.getByLabelText('Sort events'), { target: { value: 'newest' } });
    });
    const params = new URLSearchParams(screen.getByTestId('event-location').textContent ?? '');
    expect(params.get('q')).toBe('AN-J-014');
    expect(params.get('status')).toBe('OPEN');
    expect(params.get('sort')).toBe('newest');
  });
  it('clears every query filter and stale event selection together', () => {
    setup('/events?q=014&status=OPEN&sort=newest&event=old-event');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('event-location').textContent).toBe('');
  });
});
