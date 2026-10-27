import { useState } from 'react';
import type { EventFilters } from '../../services/eventFilters';
import { MAX_EVENT_VIEWS, loadSavedEventViews, persistSavedEventViews, type SavedEventView } from '../../services/eventViews';

function sameFilters(a: EventFilters, b: EventFilters): boolean {
  return a.q === b.q && a.severity === b.severity && a.status === b.status && a.zone === b.zone && a.sort === b.sort;
}

export function SavedEventViews({ filters, onApply }: { filters: EventFilters; onApply: (filters: EventFilters) => void }) {
  const [saved, setSaved] = useState(loadSavedEventViews);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const active = saved.views.find((view) => view.id === selectedId && sameFilters(view.filters, filters))
    ?? saved.views.find((view) => sameFilters(view.filters, filters));

  const persist = (views: SavedEventView[], message: string) => {
    const stored = persistSavedEventViews(views);
    setSaved({ views, error: null });
    setNotice(stored ? message : `${message} Browser storage is unavailable; changes last for this session.`);
  };

  const save = () => {
    const label = name.trim().slice(0, 60);
    if (!label) return;
    const existing = saved.views.find((view) => view.name.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (!existing && saved.views.length >= MAX_EVENT_VIEWS) { setNotice(`You can save up to ${MAX_EVENT_VIEWS} views. Delete one to add another.`); return; }
    const view: SavedEventView = { id: existing?.id ?? `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: label, filters: { ...filters } };
    persist(existing ? saved.views.map((item) => item.id === existing.id ? view : item) : [...saved.views, view], `Saved view “${label}”.`);
    setSelectedId(view.id);
    setName('');
  };

  return <div className="event-tools event-saved-views" role="group" aria-label="Saved event views">
    <select aria-label="Load saved event view" value={active?.id ?? ''} onChange={(event) => {
      const view = saved.views.find((item) => item.id === event.target.value);
      if (view) { setSelectedId(view.id); onApply(view.filters); setNotice(`Loaded view “${view.name}”.`); }
    }}>
      <option value="">{saved.views.length ? 'Choose saved view' : 'No saved views'}</option>
      {saved.views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
    </select>
    <button className="btn" type="button" disabled={!active} onClick={() => {
      if (active) persist(saved.views.filter((view) => view.id !== active.id), `Deleted view “${active.name}”.`);
    }}>Delete view</button>
    <input aria-label="New event view name" placeholder="Name this filter view" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); save(); } }} />
    <button className="btn" type="button" disabled={!name.trim()} onClick={save}>Save view</button>
    {(notice || saved.error) && <p className="event-tools-summary" role="status">{notice || saved.error}</p>}
  </div>;
}
