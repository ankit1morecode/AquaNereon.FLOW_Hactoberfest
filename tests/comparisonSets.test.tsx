/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SavedComparisonSets } from '../src/pages/NodeComparison/SavedComparisonSets';
import { COMPARISON_SETS_KEY, createComparisonSets, parseComparisonSets } from '../src/services/comparisonSets';
afterEach(cleanup);
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('named comparison sets', () => {
  it('validates persisted node identities and rejects corrupt or unsupported storage', () => {
    expect(() => parseComparisonSets('{invalid')).toThrow();
    const valid = { id: 'set1', name: 'Feeders', nodeIds: ['B', 'A'] };
    expect(parseComparisonSets(JSON.stringify({ version: 1, sets: [valid, { ...valid, id: 'duplicate' }, { id: 'invalid', name: 'One', nodeIds: ['A'] }] }))).toEqual([valid]);
    expect(() => parseComparisonSets(JSON.stringify({ version: 2, sets: [] }))).toThrow();
  });
  it('persists reference order, updates the same name and does not store telemetry', () => {
    const storage = memory();
    const store = createComparisonSets(() => storage);
    expect(store.save('Feeders', ['B', 'A']).error).toBeNull();
    expect(store.save('feeders', ['C', 'A']).error).toBeNull();
    const restored = createComparisonSets(() => storage).getSnapshot().sets;
    expect(restored).toHaveLength(1);
    expect(restored[0].nodeIds).toEqual(['C', 'A']);
    expect(Object.keys(restored[0]).sort()).toEqual(['id', 'name', 'nodeIds']);
    expect(storage.getItem(COMPARISON_SETS_KEY)).toContain('feeders');
    expect(store.save('invalid', ['A', 'A']).error).toBeTruthy();
  });
  it('keeps changes in session memory through remounts when storage fails', () => {
    const store = createComparisonSets(() => { throw new Error('Denied'); });
    const onLoad = vi.fn();
    const view = render(<SavedComparisonSets ids={['B', 'A']} onLoad={onLoad} store={store} />);
    fireEvent.change(screen.getByLabelText('New comparison set name'), { target: { value: 'Session set' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comparison set' }));
    const id = store.getSnapshot().sets[0].id;
    view.unmount();
    render(<SavedComparisonSets ids={[]} onLoad={onLoad} store={store} />);
    fireEvent.change(screen.getByLabelText('Saved comparison sets'), { target: { value: id } });
    expect(onLoad).toHaveBeenCalledWith(['B', 'A']);
    expect(screen.getByText(/kept for this session/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete comparison set' }));
    expect(store.getSnapshot().sets).toEqual([]);
  });
  it('enforces a bounded set count without overwriting existing names', () => {
    const storage = memory();
    const store = createComparisonSets(() => storage);
    for (let index = 0; index < 12; index++) expect(store.save(`Set ${index}`, ['A', 'B']).error).toBeNull();
    expect(store.save('Overflow', ['A', 'B']).error).toContain('12');
    expect(store.save('Set 0', ['B', 'A']).error).toBeNull();
    expect(store.getSnapshot().sets).toHaveLength(12);
  });
});
