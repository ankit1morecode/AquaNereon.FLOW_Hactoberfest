/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { AlertInbox } from '../src/app/AlertInbox';
import { ALERT_INBOX_KEY, createInboxPreferences, inboxEvents, markInboxRead } from '../src/services/alertInbox';
import type { WaterEvent } from '../src/types';

const fixture = vi.hoisted(() => ({ events: [] as WaterEvent[], available: true, error: null as Error | null }));
vi.mock('../src/services/ApiProvider', () => ({ useQuery: () => ({ data: fixture.available ? { items: fixture.events, total: 350 } : undefined, error: fixture.error }) }));
vi.mock('../src/services/watchlist', () => ({ useWatchlist: () => ({ ids: ['watched'] }) }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
beforeEach(() => { fixture.events = []; fixture.available = true; fixture.error = null; });
function event(id: string, severity: WaterEvent['severity'], node = 'other', status: WaterEvent['status'] = 'OPEN'): WaterEvent {
  return { event_id: id, node_id: node, severity, status, timestamp: '2026-10-27T10:00:00Z', event_type: 'FLOW_ANOMALY' } as WaterEvent;
}
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('operator alert inbox', () => {
  it('prioritizes open high-severity events and watched nodes without changing the event list', () => {
    const events = [event('low', 'LOW'), event('watched', 'INFO', 'watched'), event('high', 'HIGH'), event('closed', 'CRITICAL', 'watched', 'CLOSED')];
    expect(inboxEvents(events, 'important', ['watched']).map((item) => item.event_id)).toEqual(['high', 'watched']);
    expect(inboxEvents(events, 'watchlist', ['watched']).map((item) => item.event_id)).toEqual(['watched']);
    expect(inboxEvents(events, 'all', []).length).toBe(3);
    expect(events[0].event_id).toBe('low');
  });
  it('bounds read markers and rejects malformed persisted preferences', () => {
    const storage = memory();
    storage.setItem(ALERT_INBOX_KEY, '{invalid');
    expect(createInboxPreferences(() => storage).read().persisted).toBe(false);
    storage.setItem(ALERT_INBOX_KEY, JSON.stringify({ version: 1, mode: 'unknown', read: ['a', 'a', null, 1] }));
    expect(createInboxPreferences(() => storage).read().preferences).toEqual({ mode: 'important', read: ['a'] });
    expect(markInboxRead({ mode: 'all', read: [] }, Array.from({ length: 1200 }, (_, i) => String(i))).read).toHaveLength(1000);
  });
  it('keeps read markers through remounts when storage is inaccessible', () => {
    const store = createInboxPreferences(() => { throw new Error('Denied'); });
    store.write({ mode: 'watchlist', read: ['EV-1'] });
    expect(store.read()).toEqual({ persisted: false, preferences: { mode: 'watchlist', read: ['EV-1'] } });
  });
  it('marks shown alerts as read locally and opens the actual event link', () => {
    fixture.events = [event('EV-1', 'HIGH')];
    const store = createInboxPreferences(() => memoryStorage);
    const memoryStorage = memory();
    function Location() { const location = useLocation(); return <output data-testid="inbox-location">{location.pathname}{location.search}</output>; }
    render(<MemoryRouter><AlertInbox store={store} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Alert inbox, 1 unread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark shown as read' }));
    expect(store.read().preferences.read).toEqual(['EV-1']);
    expect(screen.getByRole('button', { name: 'Alert inbox, 0 unread' })).toBeTruthy();
    expect(screen.getByText(/1 loaded of 350 available/)).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /other/ }));
    expect(screen.getByTestId('inbox-location').textContent).toBe('/events?event=EV-1');
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
  it('distinguishes loading, unavailable and cached counts instead of claiming zero unread', () => {
    fixture.available = false;
    const memoryStorage = memory();
    const store = createInboxPreferences(() => memoryStorage);
    const page = () => <MemoryRouter><AlertInbox store={store} /></MemoryRouter>;
    const view = render(page());
    fireEvent.click(screen.getByRole('button', { name: 'Alert inbox, loading alerts' }));
    expect(screen.getByText('Loading alerts…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Alert inbox, 0 unread' })).toBeNull();
    fixture.error = new Error('Events endpoint unavailable');
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'Alert inbox, alerts unavailable' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Events endpoint unavailable');
    expect((screen.getByRole('button', { name: 'Mark shown as read' }) as HTMLButtonElement).disabled).toBe(true);
    fixture.available = true; fixture.events = [event('EV-1', 'HIGH')];
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'Alert inbox, 1 unread in cached data; refresh failed' })).toBeTruthy();
    expect(screen.getByText('1 stale')).toBeTruthy();
    expect(screen.getByText(/1 unread of 1 matching open events in cached data/)).toBeTruthy();
    fixture.error = null;
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'Alert inbox, 1 unread' })).toBeTruthy();
    expect(screen.queryByText('1 stale')).toBeNull();
  });
  it('closes an open inbox when the route changes outside its event links', () => {
    const memoryStorage = memory();
    const store = createInboxPreferences(() => memoryStorage);
    render(<MemoryRouter><AlertInbox store={store} /><Link to="/reports">Navigate to reports</Link></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Alert inbox, 0 unread' }));
    expect(document.querySelector('dialog')?.open).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Navigate to reports' }));
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
});
