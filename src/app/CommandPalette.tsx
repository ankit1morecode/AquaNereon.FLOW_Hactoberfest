import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '../services/ApiProvider';
import './command-palette.css';

export interface NavigationCommand {
  id: string;
  label: string;
  detail: string;
  to: string;
}

const PAGES: NavigationCommand[] = [
  { id: 'city', label: 'City Command', detail: 'Network overview', to: '/' },
  { id: 'zones', label: 'Zone Intelligence', detail: 'Demand and losses', to: '/zones' },
  { id: 'nodes', label: 'Node Directory', detail: 'Search all junctions', to: '/nodes' },
  { id: 'compare', label: 'Compare Nodes', detail: 'Side-by-side diagnostics', to: '/compare' },
  { id: 'network', label: 'Network Inventory', detail: 'Pipes, assets and structural topology', to: '/network' },
  { id: 'events', label: 'Events', detail: 'Incidents and evidence', to: '/events' },
  { id: 'reports', label: 'Reports', detail: 'History and handoff', to: '/reports' },
  { id: 'viz', label: '3D Junction', detail: 'Interactive flow visualization', to: '/viz' },
];

export function searchCommands(commands: NavigationCommand[], query: string): NavigationCommand[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((command) => {
    const text = `${command.label} ${command.detail}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  }).slice(0, 30);
}

/** Native modal focus management keeps keyboard navigation inside the palette. */
export function CommandPalette() {
  const navigate = useNavigate();
  const nodes = useQuery((client) => client.getNodes(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const commands = useMemo(() => [
    ...PAGES,
    ...(nodes.data ?? []).map((node) => ({
      id: node.node_id,
      label: node.node_id,
      detail: `${node.location.label} · ${node.zone_id}`,
      to: `/nodes/${encodeURIComponent(node.node_id)}`,
    })),
  ], [nodes.data]);
  const results = searchCommands(commands, query);
  const selected = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        // Keep the active modal's focus and keyboard context intact. The
        // palette's own open dialog still allows Ctrl+K to toggle it closed.
        if ([...document.querySelectorAll('dialog[open]')].some((modal) => modal !== dialog.current)) return;
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open) {
      setQuery('');
      setActive(0);
      if (!modal.open) modal.showModal();
      input.current?.focus();
    } else if (modal.open) {
      modal.close();
      trigger.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`command-${selected}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [selected, open]);

  const choose = (command: NavigationCommand) => {
    setOpen(false);
    navigate(command.to);
  };

  return <>
    <button ref={trigger} type="button" className="btn command-trigger" onClick={() => setOpen(true)}
      aria-haspopup="dialog" title="Quick navigation (Ctrl+K or ⌘K)">
      Search <kbd>Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="command-dialog" aria-labelledby="command-title"
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="command-content">
        <div className="command-heading">
          <h2 id="command-title">Quick navigation</h2>
          <button type="button" className="btn" onClick={() => setOpen(false)} aria-label="Close quick navigation">Esc</button>
        </div>
        <input ref={input} type="search" placeholder="Search pages, node IDs or locations…" value={query}
          aria-label="Search pages and nodes" role="combobox" aria-expanded={open}
          aria-autocomplete="list" aria-controls="command-results"
          aria-activedescendant={results.length ? `command-${selected}` : undefined}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (results.length) setActive((selected + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (results[selected]) choose(results[selected]);
            }
          }} />
        <div id="command-results" role="listbox" aria-label="Navigation results" className="command-results">
          {results.map((command, index) => <button key={command.id} id={`command-${index}`}
            type="button" role="option" aria-selected={selected === index}
            className={selected === index ? 'command-result selected' : 'command-result'}
            onMouseMove={() => setActive(index)} onClick={() => choose(command)}>
            <strong>{command.label}</strong><span>{command.detail}</span>
          </button>)}
        </div>
        <p className="command-hint" role="status">{results.length ? `${results.length} results · ↑ ↓ to move · Enter to open` : 'No matching pages or nodes.'}</p>
      </div>
    </dialog>
  </>;
}
