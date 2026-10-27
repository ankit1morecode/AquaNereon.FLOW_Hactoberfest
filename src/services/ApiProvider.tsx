import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ApiClient } from './client';
import { HttpApiClient } from './httpClient';
import { PlatformSimulator } from './platformSimulator';
import { SimulatedApiClient } from './simulatedClient';

/**
 * Wires one API client into the tree, and gives pages a way to read from it.
 *
 * Which client is chosen is the only place in the frontend that knows whether
 * a backend exists. `VITE_API_BASE_URL` in the environment switches to the
 * real one; without it the platform simulator runs in the browser.
 */

interface ApiContextValue {
  client: ApiClient;
  /** Present only in simulation, for pages that want to drive the clock. */
  platform: PlatformSimulator | null;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ApiContextValue>(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (baseUrl) {
      return { client: new HttpApiClient({ baseUrl }), platform: null };
    }
    const platform = new PlatformSimulator({ timeScale: 6, tickHz: 4 });
    return { client: new SimulatedApiClient(platform), platform };
  }, []);

  // Start and stop with the effect, not with the memo. React runs an effect's
  // cleanup on its simulated unmount in development, so a platform started
  // during construction gets stopped once and never restarted — which shows up
  // as a frozen clock and no events, and nowhere near the code that caused it.
  useEffect(() => {
    value.platform?.start();
    return () => value.platform?.stop();
  }, [value]);

  // Dev handle, so the running platform can be inspected or driven from the
  // console without instrumenting the render path.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { aquaPlatform?: PlatformSimulator | null }).aquaPlatform =
      value.platform;
  }, [value]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>');
  return ctx.client;
}

export function usePlatform(): PlatformSimulator | null {
  return useContext(ApiContext)?.platform ?? null;
}

/* ------------------------------------------------------------------ */
/* Query hook                                                          */
/* ------------------------------------------------------------------ */

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  /** True only on the first load, so refreshes do not flash the UI back to a spinner. */
  loading: boolean;
  /** Wall clock of the most recent successful read of this query. */
  updatedAt: number | null;
  refreshing: boolean;
  refresh: () => void;
}

const REFRESH_QUERIES = 'aquanereon:refresh-queries';

/** Refresh all mounted queries through their existing API client. */
export function refreshQueries(): void {
  window.dispatchEvent(new Event(REFRESH_QUERIES));
}

/**
 * Read from the API and re-read whenever the client says something changed.
 *
 * Deliberately small. The alternative is a caching query library, and nothing
 * here needs one: every screen reads a handful of endpoints from a source that
 * already tells it when to look again.
 *
 * `deps` must include everything the fetcher closes over, the same as an effect.
 */
export function useQuery<T>(
  fetcher: (client: ApiClient) => Promise<T>,
  deps: unknown[],
): QueryState<T> {
  const client = useApi();
  // A key change hides the previous resource immediately, before effects run.
  // Late replies are ignored by the effect's cancellation guard.
  const queryKey = useMemo(() => Symbol('query'), [client, ...deps]);
  type StoredState = Omit<QueryState<T>, 'refresh'> & { key: symbol };
  const empty: StoredState = {
    key: queryKey,
    data: undefined,
    error: null,
    loading: true,
    updatedAt: null,
    refreshing: false,
  };
  const [state, setState] = useState<StoredState>(empty);
  const activeRun = useRef<{ key: symbol; run: () => Promise<void> } | null>(null);
  const refresh = useCallback(() => {
    if (activeRun.current?.key === queryKey) void activeRun.current.run();
  }, [queryKey]);

  // Keep the newest fetcher without making it a dependency, so callers can
  // write it inline without re-subscribing on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const run = async () => {
      // Drop a refresh that lands while the previous one is still open, rather
      // than queueing them: on a fast tick that would spiral.
      if (cancelled || inFlight) return;
      inFlight = true;
      setState((previous) => ({ ...(previous.key === queryKey ? previous : empty), refreshing: true }));
      try {
        const data = await fetcherRef.current(client);
        if (!cancelled) setState({ key: queryKey, data, error: null, loading: false, updatedAt: Date.now(), refreshing: false });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            key: queryKey,
            data: prev.key === queryKey ? prev.data : undefined,
            error: err instanceof Error ? err : new Error(String(err)),
            loading: false,
            updatedAt: prev.key === queryKey ? prev.updatedAt : null,
            refreshing: false,
          }));
        }
      } finally {
        inFlight = false;
      }
    };

    activeRun.current = { key: queryKey, run };
    void run();
    const unsubscribe = client.subscribe(() => void run());
    const onRefresh = () => void run();
    window.addEventListener(REFRESH_QUERIES, onRefresh);
    return () => {
      cancelled = true;
      if (activeRun.current?.key === queryKey) activeRun.current = null;
      window.removeEventListener(REFRESH_QUERIES, onRefresh);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryKey]);

  return { ...(state.key === queryKey ? state : empty), refresh };
}
