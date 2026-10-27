/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createIncidentNotebook, INCIDENT_NOTES_KEY, MAX_NOTE_LENGTH, MAX_NOTES_PER_INCIDENT, parseIncidentNotes } from '../src/services/incidentNotebook';
import { IncidentNotebook } from '../src/pages/Events/IncidentNotebook';

afterEach(cleanup);
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const input = { event_id: 'EV-1', node_id: 'AN-J-014', text: 'Inspect downstream coupling.' };

describe('local incident notebook', () => {
  it('persists add/edit/delete with original creation time and exact incident/node scope', () => {
    const storage = memoryStorage();
    const store = createIncidentNotebook(() => storage);
    expect(store.save(input)).toBeNull();
    const original = store.getSnapshot().notes[0];
    expect(store.save({ ...input, event_id: 'EV-2', text: 'Wrong event edit' }, original.id)).toContain('no longer available');
    expect(store.save({ ...input, text: 'Inspection scheduled.' }, original.id)).toBeNull();
    const loaded = createIncidentNotebook(() => storage);
    expect(loaded.getSnapshot().notes[0]).toMatchObject({ text: 'Inspection scheduled.', created_at: original.created_at });
    loaded.remove('EV-2', input.node_id, original.id);
    expect(loaded.getSnapshot().notes).toHaveLength(1);
    loaded.remove(input.event_id, input.node_id, original.id);
    expect(parseIncidentNotes(storage.getItem(INCIDENT_NOTES_KEY))).toEqual([]);
  });
  it('rejects blank or oversized notes and bounds notes per incident', () => {
    const store = createIncidentNotebook(() => memoryStorage());
    expect(store.save({ ...input, text: '  ' })).toContain('characters');
    expect(store.save({ ...input, text: 'x'.repeat(MAX_NOTE_LENGTH + 1) })).toContain('characters');
    for (let index = 0; index < MAX_NOTES_PER_INCIDENT; index++) expect(store.save({ ...input, text: `Note ${index}` })).toBeNull();
    expect(store.save(input)).toContain('limit');
    expect(store.getSnapshot().notes).toHaveLength(MAX_NOTES_PER_INCIDENT);
  });
  it('recovers from corrupt data and retains session notes when storage is denied', () => {
    const corrupt = createIncidentNotebook(() => ({ getItem: () => '{invalid', setItem: () => { throw new Error('full'); } }));
    expect(corrupt.getSnapshot()).toMatchObject({ notes: [], persisted: false });
    expect(corrupt.save(input)).toBeNull();
    expect(corrupt.getSnapshot().notes[0].text).toBe(input.text);
    expect(corrupt.getSnapshot().warning).toContain('session');
    const denied = createIncidentNotebook(() => { throw new Error('Denied'); });
    expect(denied.save(input)).toBeNull();
    const view = render(<IncidentNotebook eventId={input.event_id} nodeId={input.node_id} store={denied} />);
    expect(screen.getByText(input.text)).toBeTruthy();
    view.unmount();
    render(<IncidentNotebook eventId={input.event_id} nodeId={input.node_id} store={denied} />);
    expect(screen.getByText(input.text)).toBeTruthy();
  });
  it('renders plain text and keeps editing drafts scoped when selection changes', () => {
    const storage = memoryStorage();
    const store = createIncidentNotebook(() => storage);
    const view = render(<IncidentNotebook eventId="EV-1" nodeId="AN-J-014" store={store} />);
    fireEvent.change(screen.getByLabelText('Add local note'), { target: { value: '<script>alert(1)</script>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit note 1' }));
    fireEvent.change(screen.getByLabelText('Edit local note'), { target: { value: 'Unfinished edit' } });
    view.rerender(<IncidentNotebook eventId="EV-2" nodeId="AN-J-014" store={store} />);
    expect((screen.getByLabelText('Add local note') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByText('<script>alert(1)</script>')).toBeNull();
    view.rerender(<IncidentNotebook eventId="EV-1" nodeId="AN-J-014" store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note 1' }));
    expect(screen.queryByText('<script>alert(1)</script>')).toBeNull();
  });
});
