import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_OPERATOR_PREFERENCES, operatorPreferences, useOperatorPreferences, type OperatorPreferenceStore, type OperatorPreferences } from '../services/operatorPreferences';
import './display-preferences.css';

export function DisplayPreferences({ store = operatorPreferences }: { store?: OperatorPreferenceStore }) {
  const { preferences, persisted } = useOperatorPreferences(store);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const previousRoute = useRef(route);
  useEffect(() => {
    if (previousRoute.current !== route) { previousRoute.current = route; setOpen(false); }
  }, [route]);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open && !modal.open) modal.showModal();
    else if (!open && modal.open) { modal.close(); trigger.current?.focus(); }
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Display</button>
    <dialog ref={dialog} className="display-dialog" aria-labelledby="display-title" aria-describedby="display-scope"
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="display-content">
        <header><h2 id="display-title">Display preferences</h2><button type="button" className="btn" aria-label="Close display preferences" onClick={() => setOpen(false)}>Close</button></header>
        <p id="display-scope">Changes apply immediately and are saved in this browser.</p>
        <label>Layout density<select value={preferences.density} onChange={(event) => store.update({ density: event.target.value as OperatorPreferences['density'] })}>
          <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
        </select></label>
        <label>Interface animation<select value={preferences.motion} onChange={(event) => store.update({ motion: event.target.value as OperatorPreferences['motion'] })}>
          <option value="system">Follow system preference</option><option value="reduced">Reduce animation</option><option value="full">Full animation</option>
        </select></label>
        <label className="display-check"><input type="checkbox" checked={preferences.highContrast} onChange={(event) => store.update({ highContrast: event.target.checked })} />Higher text contrast</label>
        <p>Animation preferences affect interface transitions and map effects. Use playback controls to pause the 3D view.</p>
        <button type="button" className="btn" onClick={() => store.update(DEFAULT_OPERATOR_PREFERENCES)}>Reset display preferences</button>
        {!persisted && <p role="status">Browser storage is unavailable. Your display choices are kept for this session.</p>}
      </div>
    </dialog>
  </>;
}
