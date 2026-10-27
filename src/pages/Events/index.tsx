import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, usePlatform } from '../../services/ApiProvider';
import { EventTimeline } from '../../components/EventTimeline';
import { EvidencePanel } from '../../components/EvidencePanel';
import { NetworkMap } from '../../components/NetworkMap';
import { Empty, ErrorNote, Loading, Panel } from '../../components/ui';
import type { WaterEvent } from '../../types';
import { EVENT_SEVERITIES, EVENT_STATUSES, filterEvents, readEventFilters, writeEventFilters, type EventFilters, type EventSort } from '../../services/eventFilters';
import './events.css';
import { SavedEventViews } from './SavedEventViews';
import { EventCsvExport } from './EventCsvExport';
import { IncidentNotebook } from './IncidentNotebook';
import { useEventBookmarks } from '../../services/eventBookmarks';

/**
 * Event Center.
 *
 * A prioritised list on the left and the full evidence chain on the right. The
 * split is the point: no event can be acted on from the list alone, and
 * selecting one always shows why it exists before offering anything to do
 * about it.
 */

export function Events() {
  const [params, setParams] = useSearchParams();
  // Router navigations can be batched. Keep pending edits so fast changes to
  // different controls do not overwrite a URL update that has not rendered yet.
  const pendingParams = useRef(params);
  useEffect(() => { pendingParams.current = params; }, [params]);
  const navigate = useNavigate();
  const platform = usePlatform();
  const client = useApi();
  const bookmarks = useEventBookmarks();
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const bookmarksOnly = params.get('bookmarks') === '1';

  const filters = useMemo(() => readEventFilters(params), [params]);
  const updateFilters = (changes: Partial<EventFilters>) => {
    const next = writeEventFilters(pendingParams.current, changes);
    pendingParams.current = next;
    setParams(next, { replace: true });
  };

  const events = useQuery((c) => c.getEvents({ limit: 200 }), []);
  const recommendations = useQuery((c) => c.getRecommendations(), []);
  const network = useQuery((c) => c.getNetwork(), []);
  const nodes = useQuery((c) => c.getNodes(), []);

  const selectedId = params.get('event');

  const filtered = useMemo(() => filterEvents(events.data?.items ?? [], filters).filter((event) => !bookmarksOnly || bookmarks.ids.includes(event.event_id)), [events.data, filters, bookmarksOnly, bookmarks.ids]);
  const loadedBookmarkCount = (events.data?.items ?? []).filter((event) => bookmarks.ids.includes(event.event_id)).length;

  const selected =
    filtered.find((e) => e.event_id === selectedId) ?? filtered[0] ?? null;
  const zones = network.data?.zones ?? [...new Set((events.data?.items ?? []).map((event) => event.zone_id))].map((zone_id) => ({ zone_id, name: zone_id }));
  const hasFilters = Boolean(filters.q || filters.severity || filters.status || filters.zone || bookmarksOnly);

  const setStatusFor = async (event: WaterEvent, next: WaterEvent['status']) => {
    // The simulator owns event state; a real backend would take a PATCH. Both
    // go through the client so the page never reaches past its own boundary.
    if (platform) {
      platform.setEventStatus(event.event_id, next);
    } else {
      await client.postEvent({ ...event, status: next });
    }
  };

  if (events.error) return <ErrorNote error={events.error} />;
  if (!events.data) return <Loading what="events" />;

  const openCount = (events.data.items ?? []).filter((e) => e.status !== 'CLOSED').length;

  return (
    <div className="page events-page">
      <div className="ep-list">
        <Panel
          title="Events"
          subtitle={`${openCount} open · ${filtered.length} matching of ${events.data.items.length} loaded`}
          scroll
        >
            <div className="event-tools" role="search" aria-label="Search and filter events">
              <input className="event-search" type="search" aria-label="Search events" placeholder="Search event, node, type or evidence…" maxLength={200} value={filters.q} onChange={(e) => updateFilters({ q: e.target.value })} />
              <select
                value={filters.severity}
                onChange={(e) => updateFilters({ severity: e.target.value as EventFilters['severity'] })}
                aria-label="Filter by severity"
              >
                <option value="">all severities</option>
                {EVENT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value as EventFilters['status'] })}
                aria-label="Filter by status"
              >
                <option value="">all statuses</option>
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </select>
              <select aria-label="Filter events by zone" value={filters.zone} onChange={(e) => updateFilters({ zone: e.target.value })}>
                <option value="">all zones</option>
                {filters.zone && !zones.some((zone) => zone.zone_id === filters.zone) && <option value={filters.zone}>{filters.zone}</option>}
                {zones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}</option>)}
              </select>
              <select aria-label="Sort events" value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value as EventSort })}>
                <option value="priority">priority first</option><option value="newest">newest first</option><option value="oldest">oldest first</option><option value="anomaly">highest anomaly</option>
              </select>
              <label className="event-bookmark-filter"><input type="checkbox" aria-label="Bookmarked events only" checked={bookmarksOnly} onChange={(event) => {
                const next = new URLSearchParams(pendingParams.current);
                if (event.target.checked) next.set('bookmarks', '1'); else next.delete('bookmarks');
                next.delete('event'); pendingParams.current = next; setParams(next, { replace: true });
              }} />Bookmarked only ({loadedBookmarkCount} loaded)</label>
              <button className="btn" type="button" disabled={!hasFilters && filters.sort === 'priority'} onClick={() => {
                const next = writeEventFilters(pendingParams.current, { q: '', severity: '', status: '', zone: '', sort: 'priority' });
                next.delete('bookmarks'); pendingParams.current = next; setParams(next, { replace: true });
              }}>Clear filters</button>
              <EventCsvExport events={filtered} />
              {bookmarks.warning && <p className="event-tools-summary" role="status">{bookmarks.warning}</p>}
              {bookmarkError && <p className="event-tools-summary" role="alert">{bookmarkError}</p>}
              {events.data.total > events.data.items.length && <p className="event-tools-summary">Showing the latest {events.data.items.length} of {events.data.total} events. Search and export apply to loaded events.</p>}
            </div>
          <SavedEventViews filters={filters} onApply={updateFilters} />
          <EventTimeline
            events={filtered}
            preserveOrder
            selected={selected?.event_id ?? null}
            onSelect={(id) => { const next = new URLSearchParams(pendingParams.current); next.set('event', id); pendingParams.current = next; setParams(next); }}
            emptyNote={
              hasFilters
                ? 'No events match this filter.'
                : 'No events. Every node is reading within its baseline.'
            }
          />
        </Panel>
      </div>

      <div className="ep-detail">
        {selected && network.data && nodes.data && (
          <Panel
            title="Where"
            subtitle={
              selected.network_context.propagation === 'LOCAL'
                ? 'Local to this node — nothing upstream explains it'
                : 'Traced back through its disturbed feeders'
            }
            className="map-panel ep-map"
          >
            <NetworkMap
              network={network.data}
              nodes={nodes.data}
              events={events.data.items}
              selected={selected.node_id}
              focusEvent={selected}
              followEvent
              onSelect={(id) => navigate(`/nodes/${id}`)}
              height="100%"
            />
          </Panel>
        )}

        {selected ? (
          <Panel title="Why this event exists" subtitle="Evidence chain, model outputs and context" actions={
            <button type="button" className="btn" aria-label={`${bookmarks.ids.includes(selected.event_id) ? 'Remove bookmark for' : 'Bookmark'} ${selected.event_id}`} aria-pressed={bookmarks.ids.includes(selected.event_id)} title="Bookmarks are saved in this browser" onClick={() => setBookmarkError(bookmarks.toggle(selected.event_id))}>
              {bookmarks.ids.includes(selected.event_id) ? '★ Bookmarked' : '☆ Bookmark event'}
            </button>
          }>
            <EvidencePanel
              event={selected}
              onStatusChange={(next) => void setStatusFor(selected, next)}
            />
          </Panel>
        ) : (
          <Panel title="Evidence">
            <Empty>Select an event to see the evidence it was formed from.</Empty>
          </Panel>
        )}

        {selected && <IncidentNotebook eventId={selected.event_id} nodeId={selected.node_id} />}

        <Panel title="Recommendations" subtitle="Derived from open events" scroll>
          {(recommendations.data ?? []).length === 0 ? (
            <Empty>No recommendations outstanding.</Empty>
          ) : (
            <ul className="rec-list">
              {(recommendations.data ?? []).slice(0, 8).map((rec) => (
                <li key={rec.recommendation_id}>
                  <div className="rec-head">
                    <span className={`rec-prio p${rec.priority}`}>P{rec.priority}</span>
                    <code>{rec.node_id ?? rec.zone_id}</code>
                    <span className="rec-status">{rec.status.toLowerCase()}</span>
                  </div>
                  <p className="rec-action">{rec.action}</p>
                  <p className="rec-why">{rec.rationale}</p>
                  <p className="rec-verify">
                    <strong>Verify:</strong> {rec.verification}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
