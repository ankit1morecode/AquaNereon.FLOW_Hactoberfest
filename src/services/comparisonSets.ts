import { useSyncExternalStore } from 'react';

export const COMPARISON_SETS_KEY = 'aquanereon.comparison-sets.v1';
export const MAX_COMPARISON_SETS = 12;
export interface ComparisonSet { id: string; name: string; nodeIds: string[] }
export interface ComparisonSetSnapshot { sets: ComparisonSet[]; persisted: boolean; warning: string | null }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const nodeIds = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200))] : [];
const sameIds = (one: string[], two: string[]) => one.length === two.length && one.every((id, index) => id === two[index]);

export function parseComparisonSets(raw: string | null): ComparisonSet[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('sets' in data) || !Array.isArray(data.sets)) throw new Error('Invalid comparison sets');
  const ids = new Set<string>();
  const names = new Set<string>();
  const valid: ComparisonSet[] = [];
  for (const value of data.sets.slice(0, MAX_COMPARISON_SETS)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const nodes = nodeIds(entry.nodeIds);
    if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 200 || ids.has(entry.id)
      || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.trim().length > 60
      || nodes.length < 2 || nodes.length > 3 || !Array.isArray(entry.nodeIds) || !sameIds(nodes, entry.nodeIds)) continue;
    const name = entry.name.trim();
    if (names.has(name.toLocaleLowerCase())) continue;
    valid.push({ id: entry.id, name, nodeIds: nodes });
    ids.add(entry.id); names.add(name.toLocaleLowerCase());
  }
  return valid;
}

export function createComparisonSets(getStorage: () => StoragePort = () => window.localStorage) {
  let snapshot: ComparisonSetSnapshot | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): ComparisonSetSnapshot => {
    if (!snapshot) {
      try { snapshot = { sets: parseComparisonSets(getStorage().getItem(COMPARISON_SETS_KEY)), persisted: true, warning: null }; }
      catch { snapshot = { sets: [], persisted: false, warning: 'Saved comparisons could not be read. New sets are kept for this session.' }; }
    }
    return snapshot;
  };
  const persist = (sets: ComparisonSet[]) => {
    let persisted = false;
    try { getStorage().setItem(COMPARISON_SETS_KEY, JSON.stringify({ version: 1, sets })); persisted = true; } catch { /* Keep changes in session memory. */ }
    snapshot = { sets, persisted, warning: persisted ? null : 'Browser storage is unavailable. Comparison sets are kept for this session.' };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    save(nameValue: string, ids: string[]): { error: string | null; id?: string } {
      const name = nameValue.trim();
      const nodes = nodeIds(ids);
      if (!name || name.length > 60) return { error: 'Use a name between 1 and 60 characters.' };
      if (nodes.length < 2 || nodes.length > 3 || !sameIds(nodes, ids)) return { error: 'Choose two or three distinct, available nodes.' };
      const current = getSnapshot().sets;
      const existing = current.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!existing && current.length >= MAX_COMPARISON_SETS) return { error: `You can save up to ${MAX_COMPARISON_SETS} comparison sets.` };
      const id = existing?.id ?? `comparison-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const entry = { id, name, nodeIds: [...nodes] };
      persist(existing ? current.map((item) => item.id === existing.id ? entry : item) : [...current, entry]);
      return { error: null, id };
    },
    remove(id: string) { persist(getSnapshot().sets.filter((entry) => entry.id !== id)); },
  };
}

export type ComparisonSetStore = ReturnType<typeof createComparisonSets>;
export const comparisonSets = createComparisonSets();
export function useComparisonSets(store: ComparisonSetStore = comparisonSets): ComparisonSetSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
