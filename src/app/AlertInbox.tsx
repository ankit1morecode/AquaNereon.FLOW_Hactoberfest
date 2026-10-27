import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '../services/ApiProvider';
import { useWatchlist } from '../services/watchlist';
import { alertInboxPreferences, inboxEvents, markInboxRead, type InboxMode } from '../services/alertInbox';
import { relativeTime, SeverityTag } from '../components/ui';
import './alert-inbox.css';

export function AlertInbox({ store = alertInboxPreferences }: { store?: typeof alertInboxPreferences }) {
  const events = useQuery((client) => client.getEvents({ limit: 200 }), []);
  const watched = useWatchlist();
  const [settings, setSettings] = useState(() => store.read());
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const previousRoute = useRef(route);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const preferences = settings.preferences;
  const visible = inboxEvents(events.data?.items ?? [], preferences.mode, watched.ids);
  const unread = visible.filter((event) => !preferences.read.includes(event.event_id)).length;
  const triggerLabel = !events.data
    ? events.error ? 'alerts unavailable' : 'loading alerts'
    : events.error ? `${unread} unread in cached data; refresh failed` : `${unread} unread`;

  useEffect(() => {
    if (previousRoute.current !== route) {
      previousRoute.current = route;
      setOpen(false);
    }
  }, [route]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open && !modal.open) modal.showModal();
    else if (!open && modal.open) { modal.close(); trigger.current?.focus(); }
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="btn inbox-trigger" aria-haspopup="dialog"
      aria-label={`Alert inbox, ${triggerLabel}`} title={events.error ? 'Alert refresh failed. Any displayed count comes from cached data.' : undefined} onClick={() => setOpen(true)}>
      Alerts <span className="inbox-count" aria-hidden="true">{!events.data ? events.error ? '!' : '…' : events.error ? `${unread} stale` : unread}</span>
    </button>
    <dialog ref={dialog} className="inbox-dialog" aria-labelledby="inbox-title"
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="inbox-content">
        <header className="inbox-heading"><h2 id="inbox-title">Alert inbox</h2>
          <button type="button" className="btn" aria-label="Close alert inbox" onClick={() => setOpen(false)}>Close</button>
        </header>
        <div className="inbox-controls">
          <label>Show <select aria-label="Alert inbox scope" value={preferences.mode} onChange={(event) =>
            setSettings(store.write({ ...preferences, mode: event.target.value as InboxMode }))}>
            <option value="important">High priority or watched nodes</option>
            <option value="all">All open events</option>
            <option value="watchlist">Watched nodes only</option>
          </select></label>
          <button type="button" className="btn" disabled={unread === 0} onClick={() =>
            setSettings(store.write(markInboxRead(preferences, visible.map((event) => event.event_id))))}>Mark shown as read</button>
        </div>
        <p className="inbox-note">{events.data ? `${unread} unread of ${visible.length} matching open events${events.error ? ' in cached data' : ''}. ` : ''}Read markers are local to this browser.</p>
        {events.error && <p className="error-note" role="alert">Could not refresh alerts. {events.error.message}</p>}
        {!events.data && !events.error && <p className="empty">Loading alerts…</p>}
        {events.data && visible.length === 0 && <p className="empty">{events.error ? 'No matching open events in the cached data.' : 'No open events match this inbox scope.'}</p>}
        {visible.length > 0 && <ul className="inbox-list">{visible.map((event) => <li key={event.event_id}>
          <Link className={preferences.read.includes(event.event_id) ? 'inbox-event read' : 'inbox-event unread'}
            to={`/events?event=${encodeURIComponent(event.event_id)}`} onClick={() => {
              setSettings(store.write(markInboxRead(preferences, [event.event_id])));
              setOpen(false);
            }}>
            <span><SeverityTag severity={event.severity} /> <strong>{event.node_id}</strong></span>
            <span>{event.event_type.replace(/_/g, ' ').toLowerCase()}</span>
            <small>{preferences.read.includes(event.event_id) ? 'Read' : 'Unread'} · {relativeTime(event.timestamp)}</small>
          </Link>
        </li>)}</ul>}
        {events.data && <p className="inbox-note">Scope: {events.data.items.length} loaded of {events.data.total} available; load limit 200.</p>}
        {!settings.persisted && <p className="inbox-note" role="status">Browser storage is unavailable. Read markers and scope last for this session.</p>}
      </div>
    </dialog>
  </>;
}
