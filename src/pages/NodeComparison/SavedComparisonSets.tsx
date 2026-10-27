import { useState } from 'react';
import { comparisonSets, useComparisonSets, type ComparisonSetStore } from '../../services/comparisonSets';

export function SavedComparisonSets({ ids, availableIds = ids, onLoad, store = comparisonSets }: {
  ids: string[]; availableIds?: string[]; onLoad: (ids: string[]) => void; store?: ComparisonSetStore;
}) {
  const saved = useComparisonSets(store);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const matches = (entry: { nodeIds: string[] }) => entry.nodeIds.length === ids.length && entry.nodeIds.every((id, index) => id === ids[index]);
  const active = saved.sets.find((entry) => entry.id === selectedId && matches(entry)) ?? saved.sets.find(matches);
  const canSave = ids.length >= 2 && ids.length <= 3 && ids.every((id) => availableIds.includes(id));
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
      <button className="btn" type="button" disabled={!name.trim() || !canSave} onClick={() => {
        if (!canSave) return;
        const result = store.save(name, ids);
        if (result.error) setMessage(result.error);
        else { setSelectedId(result.id ?? ''); setName(''); setMessage(`Saved “${name.trim()}”. A matching name updates its node selection.`); }
      }}>Save comparison set</button>
    </div>
    <p className="node-results">Sets keep node IDs and their reference order in this browser; readings remain live when loaded.</p>
    {ids.length >= 2 && !canSave && <p className="node-results">Replace unavailable nodes before saving this selection. Existing saved sets can still be loaded or deleted.</p>}
    {message && <p className="node-results" role="status">{message}</p>}
    {saved.warning && <p className="node-results" role="status">{saved.warning}</p>}
  </div>;
}
