/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AlertInbox } from '../src/app/AlertInbox';
import { ALERT_INBOX_KEY, createInboxPreferences, inboxEvents, markInboxRead } from '../src/services/alertInbox';
import type { WaterEvent } from '../src/types';

const fixture = vi.hoisted(() => ({ events: [] as WaterEvent[] }));
vi.mock('../src/services/ApiProvider', () => ({ useQuery: () => ({ data: { items: fixture.events, total: 350 } }) }));
vi.mock('../src/services/watchlist', () => ({ useWatchlist: () => ({ ids: ['watched'] }) }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
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
});
