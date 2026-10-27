import { useState } from 'react';
import { Empty, Panel } from '../../components/ui';
import { incidentNotebook, MAX_NOTE_LENGTH, MAX_NOTES_PER_INCIDENT, useIncidentNotebook, type IncidentNotebookStore } from '../../services/incidentNotebook';
import './incident-notebook.css';

interface NotebookProps { eventId: string; nodeId: string; store?: IncidentNotebookStore }
function NotebookEditor({ eventId, nodeId, store = incidentNotebook }: NotebookProps) {
  const snapshot = useIncidentNotebook(store);
  const notes = snapshot.notes.filter((note) => note.event_id === eventId && note.node_id === nodeId);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | undefined>();
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  return <Panel title="Local incident notebook" subtitle={`${eventId} · ${nodeId} · ${notes.length}/${MAX_NOTES_PER_INCIDENT} notes`}>
    <p className="notebook-scope">Notes are stored in this browser for operator reference. They are not sent to the backend or recorded as an audit trail.</p>
    {snapshot.warning && <p className="notebook-warning" role="status">{snapshot.warning}</p>}
    <form className="incident-note-form" onSubmit={(event) => {
      event.preventDefault();
      const problem = store.save({ event_id: eventId, node_id: nodeId, text: draft }, editing);
      setError(problem);
      if (!problem) { setDraft(''); setEditing(undefined); setFeedback(editing ? 'Note updated.' : 'Note added.'); }
    }}>
      <label htmlFor="incident-note-text">{editing ? 'Edit local note' : 'Add local note'}</label>
      <textarea id="incident-note-text" value={draft} maxLength={MAX_NOTE_LENGTH} rows={3} onChange={(event) => { setDraft(event.target.value); setError(null); }} aria-describedby="incident-note-limit" />
      <div className="incident-note-actions">
        <span id="incident-note-limit">{draft.length}/{MAX_NOTE_LENGTH} characters</span>
        <button className="btn" type="submit" disabled={!draft.trim()}>{editing ? 'Save note' : 'Add note'}</button>
        {editing && <button className="btn" type="button" onClick={() => { setEditing(undefined); setDraft(''); setError(null); }}>Cancel edit</button>}
      </div>
      {error && <p role="alert" className="notebook-warning">{error}</p>}
      {feedback && <p role="status" className="notebook-scope">{feedback}</p>}
    </form>
    {!notes.length ? <Empty>No local notes for this incident.</Empty> : <ol className="incident-note-list">{notes.map((note, index) => <li key={note.id}>
      <p>{note.text}</p>
      <div className="incident-note-actions">
        <time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time>
        {note.updated_at !== note.created_at && <span>edited {new Date(note.updated_at).toLocaleString()}</span>}
        <button className="btn" type="button" aria-label={`Edit note ${index + 1}`} onClick={() => { setEditing(note.id); setDraft(note.text); setFeedback(''); setError(null); }}>Edit</button>
        <button className="btn" type="button" aria-label={`Delete note ${index + 1}`} onClick={() => { store.remove(eventId, nodeId, note.id); if (editing === note.id) { setEditing(undefined); setDraft(''); } setFeedback('Note deleted.'); }}>Delete</button>
      </div>
    </li>)}</ol>}
  </Panel>;
}

/** A new incident gets a fresh editor, so an unfinished draft cannot cross incident boundaries. */
export function IncidentNotebook(props: NotebookProps) {
  return <NotebookEditor key={JSON.stringify([props.eventId, props.nodeId])} {...props} />;
}
