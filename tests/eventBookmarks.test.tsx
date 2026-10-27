/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { createEventBookmarks, EVENT_BOOKMARKS_KEY, MAX_EVENT_BOOKMARKS, parseEventBookmarks } from '../src/services/eventBookmarks';
import { Events } from '../src/pages/Events';
import type { WaterEvent } from '../src/types';

const fixtures = vi.hoisted(() => ({ events: [] as WaterEvent[] }));
const api = vi.hoisted(() => ({
  getEvents: () => ({ items: fixtures.events, total: fixtures.events.length }),
  getRecommendations: () => [], getNetwork: () => null, getNodes: () => [],
}));
vi.mock('../src/services/ApiProvider', () => ({ useApi: () => api, usePlatform: () => null,
  useQuery: (fetcher: (client: typeof api) => unknown) => ({ data: fetcher(api), error: null, loading: false }),
}));
vi.mock('../src/components/EvidencePanel', () => ({ EvidencePanel: ({ event }: { event: WaterEvent }) => <div data-testid="selected-event">{event.event_id}</div> }));
afterEach(cleanup);
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function event(id: string): WaterEvent {
  return { event_id: id, node_id: 'AN-J-014', zone_id: 'Z-CENTRAL', event_type: 'FLOW_ANOMALY', timestamp: '2026-10-27T10:00:00Z', severity: 'HIGH', status: 'OPEN', anomaly_score: 0.5,
    state_transition: { from: 'DRIFT', to: 'DISTURBANCE' }, evidence: [], model_outputs: [], network_context: { upstream_states: [], downstream_states: [], propagation: 'LOCAL' },
    data_quality: { completeness: 1, confidence: 0.9, stale: false, suspect_channels: [] } };
}
function Location() { return <div data-testid="bookmark-location">{useLocation().search}</div>; }
const page = () => <MemoryRouter initialEntries={['/events?event=EV-1']}><Events /><Location /></MemoryRouter>;

describe('local event bookmarks', () => {
  it('validates and deduplicates saved IDs while keeping malformed data out', () => {
    expect(parseEventBookmarks(JSON.stringify({ version: 1, ids: ['EV-1', 'EV-1', null, 12, '', 'x'.repeat(201), 'EV-2'] }))).toEqual(['EV-1', 'EV-2']);
    const corrupt = createEventBookmarks(() => ({ getItem: () => '{bad', setItem: () => undefined }));
    expect(corrupt.getSnapshot()).toMatchObject({ ids: [], persisted: false });
    expect(corrupt.toggle('EV-1')).toBeNull();
    expect(corrupt.getSnapshot()).toMatchObject({ ids: ['EV-1'], persisted: true });
  });
  it('persists toggles and retains the latest session state when storage is blocked', () => {
    const storage = memoryStorage();
    const store = createEventBookmarks(() => storage);
    expect(store.toggle('EV-1')).toBeNull();
    expect(createEventBookmarks(() => storage).getSnapshot().ids).toEqual(['EV-1']);
    store.toggle('EV-1');
    expect(parseEventBookmarks(storage.getItem(EVENT_BOOKMARKS_KEY))).toEqual([]);
    const denied = createEventBookmarks(() => { throw new Error('Denied'); });
    denied.toggle('EV-2');
    expect(denied.getSnapshot()).toMatchObject({ ids: ['EV-2'], persisted: false });
    denied.toggle('EV-3');
    expect(denied.getSnapshot().ids).toEqual(['EV-2', 'EV-3']);
  });
  it('rejects invalid IDs and a full bookmark collection without dropping existing IDs', () => {
    const storage = memoryStorage();
    storage.setItem(EVENT_BOOKMARKS_KEY, JSON.stringify({ version: 1, ids: Array.from({ length: MAX_EVENT_BOOKMARKS }, (_, index) => `EV-${index}`) }));
    const store = createEventBookmarks(() => storage);
    expect(store.toggle('')).toContain('invalid');
    expect(store.toggle('EXTRA')).toContain('up to');
    expect(store.getSnapshot().ids).toHaveLength(MAX_EVENT_BOOKMARKS);
    expect(store.toggle('EV-1')).toBeNull();
    expect(store.toggle('EXTRA')).toBeNull();
  });
  it('filters and exports bookmarked rows, resets a removed selection and survives route remount', () => {
    localStorage.clear(); fixtures.events = [event('EV-1'), event('EV-2')];
    const view = render(page());
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark EV-1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bookmarked events only' }));
    expect(screen.getByTestId('bookmark-location').textContent).toContain('bookmarks=1');
    expect(screen.getByRole('button', { name: 'Export CSV (1)' })).toBeTruthy();
    expect(screen.getByTestId('selected-event').textContent).toBe('EV-1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark for EV-1' }));
    expect(screen.queryByTestId('selected-event')).toBeNull();
    expect(screen.getByText('No events match this filter.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('bookmark-location').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Export CSV (2)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark EV-1' }));
    view.unmount();
    render(page());
    expect(screen.getByRole('button', { name: 'Remove bookmark for EV-1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark for EV-1' }));
  });
});
