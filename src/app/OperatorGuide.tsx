import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { searchGuide } from '../services/operatorGuide';
import './operator-guide.css';

export function OperatorGuide() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const previousRoute = useRef(route);
  const topics = searchGuide(query);
  useEffect(() => {
    if (previousRoute.current !== route) { previousRoute.current = route; setOpen(false); }
  }, [route]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if ([...document.querySelectorAll('dialog[open]')].some((modal) => modal !== dialog.current)) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open) {
      setQuery('');
      if (!modal.open) modal.showModal();
      search.current?.focus();
    } else if (modal.open) { modal.close(); trigger.current?.focus(); }
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="btn" aria-haspopup="dialog" title="Operator guide (?)" onClick={() => setOpen(true)}>Help</button>
    <dialog ref={dialog} className="guide-dialog" aria-labelledby="guide-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="guide-content">
        <header><h2 id="guide-title">Operator guide</h2><button type="button" className="btn" aria-label="Close operator guide" onClick={() => setOpen(false)}>Close</button></header>
        <input ref={search} type="search" value={query} aria-label="Search operator guide" placeholder="Search workflows, data scope or shortcuts…" onChange={(event) => setQuery(event.target.value)} />
        <p className="guide-count" role="status">{topics.length} matching guide topics</p>
        <div className="guide-topics">
          {topics.map((topic) => <article key={topic.id}><h3>{topic.title}</h3><p>{topic.body}</p><Link to={topic.to} onClick={() => setOpen(false)}>{topic.action} →</Link></article>)}
          {!topics.length && <p className="empty">No guide topics match this search.</p>}
        </div>
      </div>
    </dialog>
  </>;
}
