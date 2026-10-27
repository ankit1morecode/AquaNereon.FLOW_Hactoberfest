import { useEffect, useSyncExternalStore } from 'react';

export const OPERATOR_PREFERENCES_KEY = 'aquanereon.operator-preferences.v1';
export interface OperatorPreferences {
  density: 'comfortable' | 'compact';
  motion: 'system' | 'reduced' | 'full';
  highContrast: boolean;
}
export const DEFAULT_OPERATOR_PREFERENCES: OperatorPreferences = { density: 'comfortable', motion: 'system', highContrast: false };
interface PreferenceSnapshot { preferences: OperatorPreferences; persisted: boolean }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

function normalize(value: unknown): OperatorPreferences {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    density: record.density === 'compact' ? 'compact' : 'comfortable',
    motion: record.motion === 'reduced' || record.motion === 'full' ? record.motion : 'system',
    highContrast: record.highContrast === true,
  };
}

export function createOperatorPreferences(storage: () => StoragePort = () => window.localStorage) {
  let snapshot: PreferenceSnapshot | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): PreferenceSnapshot => {
    if (!snapshot) {
      try {
        const raw = storage().getItem(OPERATOR_PREFERENCES_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : { version: 1 };
        if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) throw new Error('Unsupported preferences');
        snapshot = { preferences: normalize(parsed), persisted: true };
      } catch { snapshot = { preferences: { ...DEFAULT_OPERATOR_PREFERENCES }, persisted: false }; }
    }
    return snapshot;
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(changes: Partial<OperatorPreferences>) {
      const preferences = normalize({ ...getSnapshot().preferences, ...changes });
      let persisted = false;
      try { storage().setItem(OPERATOR_PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences })); persisted = true; } catch { /* Retain the session choice when browser storage is unavailable. */ }
      snapshot = { preferences, persisted };
      for (const listener of listeners) listener();
    },
  };
}

export const operatorPreferences = createOperatorPreferences();
export type OperatorPreferenceStore = ReturnType<typeof createOperatorPreferences>;
export function useOperatorPreferences(store: OperatorPreferenceStore = operatorPreferences) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** One application-level subscriber applies preferences across every route. */
export function useApplyOperatorPreferences(store: OperatorPreferenceStore = operatorPreferences) {
  const { preferences } = useOperatorPreferences(store);
  useEffect(() => {
    const root = document.documentElement;
    const previous = [root.dataset.uiDensity, root.dataset.uiMotion, root.dataset.uiContrast];
    root.dataset.uiDensity = preferences.density;
    root.dataset.uiMotion = preferences.motion;
    root.dataset.uiContrast = preferences.highContrast ? 'high' : 'standard';
    return () => {
      for (const [index, key] of ['uiDensity', 'uiMotion', 'uiContrast'].entries()) {
        if (previous[index] === undefined) delete root.dataset[key]; else root.dataset[key] = previous[index];
      }
    };
  }, [preferences.density, preferences.motion, preferences.highContrast]);
}
