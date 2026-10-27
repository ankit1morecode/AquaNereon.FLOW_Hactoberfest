import { useSyncExternalStore } from 'react';

export const INCIDENT_NOTES_KEY = 'aquanereon.incident-notes.v1';
export const MAX_NOTE_LENGTH = 2000;
export const MAX_NOTES_PER_INCIDENT = 50;
const MAX_NOTES = 500;
type NotebookStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface IncidentNote {
  id: string;
  event_id: string;
  node_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}
export interface NotebookSnapshot { notes: IncidentNote[]; persisted: boolean; warning: string | null }
interface NoteInput { event_id: string; node_id: string; text: string }
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const validStamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Validate browser-saved data before treating it as an operator's note. */
export function parseIncidentNotes(raw: string | null): IncidentNote[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('notes' in data) || !Array.isArray(data.notes)) throw new Error('Invalid note storage');
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  const notes: IncidentNote[] = [];
  for (const value of data.notes.slice(0, MAX_NOTES)) {
    if (!value || typeof value !== 'object') continue;
    const note = value as Record<string, unknown>;
    if (!validId(note.id) || ids.has(note.id) || !validId(note.event_id) || !validId(note.node_id)
      || typeof note.text !== 'string' || !note.text.trim() || note.text.length > MAX_NOTE_LENGTH
      || !validStamp(note.created_at) || !validStamp(note.updated_at)) continue;
    const context = JSON.stringify([note.event_id, note.node_id]);
    if ((counts.get(context) ?? 0) >= MAX_NOTES_PER_INCIDENT) continue;
    ids.add(note.id);
    counts.set(context, (counts.get(context) ?? 0) + 1);
    notes.push({ id: note.id, event_id: note.event_id, node_id: note.node_id, text: note.text, created_at: note.created_at, updated_at: note.updated_at });
  }
  return notes;
}

export function createIncidentNotebook(getStorage: () => NotebookStorage = () => window.localStorage) {
  let snapshot: NotebookSnapshot | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): NotebookSnapshot => {
    if (!snapshot) {
      try { snapshot = { notes: parseIncidentNotes(getStorage().getItem(INCIDENT_NOTES_KEY)), persisted: true, warning: null }; }
      catch { snapshot = { notes: [], persisted: false, warning: 'Saved notes could not be read. New notes are kept for this session.' }; }
    }
    return snapshot;
  };
  const persist = (notes: IncidentNote[]) => {
    let persisted = false;
    try { getStorage().setItem(INCIDENT_NOTES_KEY, JSON.stringify({ version: 1, notes })); persisted = true; } catch { /* Keep the current session usable when browser storage is denied or full. */ }
    snapshot = { notes, persisted, warning: persisted ? null : 'Browser storage is unavailable. Notes are kept for this session.' };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    save(input: NoteInput, id?: string): string | null {
      const current = getSnapshot().notes;
      if (!validId(input.event_id) || !validId(input.node_id)) return 'This incident has an invalid identifier.';
      const text = input.text.trim();
      if (!text || text.length > MAX_NOTE_LENGTH) return `Enter between 1 and ${MAX_NOTE_LENGTH} characters.`;
      const existing = id ? current.find((note) => note.id === id && note.event_id === input.event_id && note.node_id === input.node_id) : undefined;
      if (id && !existing) return 'The note is no longer available for this incident.';
      if (!existing && (current.length >= MAX_NOTES || current.filter((note) => note.event_id === input.event_id && note.node_id === input.node_id).length >= MAX_NOTES_PER_INCIDENT)) return 'The note limit has been reached. Delete an old note before adding another.';
      const timestamp = new Date().toISOString();
      const note: IncidentNote = { id: existing?.id ?? (globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(36).slice(2)}`), event_id: input.event_id, node_id: input.node_id, text, created_at: existing?.created_at ?? timestamp, updated_at: timestamp };
      persist(existing ? current.map((value) => value.id === existing.id ? note : value) : [note, ...current]);
      return null;
    },
    remove(eventId: string, nodeId: string, id: string) {
      persist(getSnapshot().notes.filter((note) => !(note.id === id && note.event_id === eventId && note.node_id === nodeId)));
    },
  };
}
export type IncidentNotebookStore = ReturnType<typeof createIncidentNotebook>;
export const incidentNotebook = createIncidentNotebook();
export function useIncidentNotebook(store: IncidentNotebookStore = incidentNotebook) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
