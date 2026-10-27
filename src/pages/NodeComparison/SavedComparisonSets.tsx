import { useState } from 'react';
import { comparisonSets, useComparisonSets, type ComparisonSetStore } from '../../services/comparisonSets';

export function SavedComparisonSets({ ids, onLoad, store = comparisonSets }: {
  ids: string[]; onLoad: (ids: string[]) => void; store?: ComparisonSetStore;
}) {
  const saved = useComparisonSets(store);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const active = saved.sets.find((entry) => entry.id === selectedId);
  return <div className="saved-comparison-sets">
    <div className="node-tools">
      <label>Saved comparison sets<select value={active?.id ?? ''} onChange={(event) => {
        const selected = saved.sets.find((entry) => entry.id === event.target.value);
        setSelectedId(selected?.id ?? '');
        if (selected) { onLoad([...selected.nodeIds]); setMessage(`Loaded “${selected.name}”. The first saved node is the reference.`); }
      }}><option value="">{saved.sets.length ? 'Choose a saved comparison' : 'No saved comparisons'}</option>
        {saved.sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label>
      <button className="btn" type="button" disabled={!active} onClick={() => {
        if (active) { store.remove(active.id); setSelectedId(''); setMessage(`Deleted “${active.name}”.`); }
      }}>Delete comparison set</button>
      <label>New comparison set name<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Name these nodes" /></label>
      <button className="btn" type="button" disabled={!name.trim() || ids.length < 2} onClick={() => {
        const result = store.save(name, ids);
        if (result.error) setMessage(result.error);
        else { setSelectedId(result.id ?? ''); setName(''); setMessage(`Saved “${name.trim()}”. A matching name updates its node selection.`); }
      }}>Save comparison set</button>
    </div>
    <p className="node-results">Sets keep node IDs and their reference order in this browser; readings remain live when loaded.</p>
    {message && <p className="node-results" role="status">{message}</p>}
    {saved.warning && <p className="node-results" role="status">{saved.warning}</p>}
  </div>;
}
