/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { ApiProvider, refreshQueries, useQuery } from '../src/services/ApiProvider';

beforeEach(() => vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test'));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('query freshness and recovery', () => {
  it('records successful reads and refreshes without discarding cached data', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const next = deferred<string>();
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('first').mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => useQuery(load, []), { wrapper: ApiProvider });
    await act(async () => {});
    expect(result.current.data).toBe('first');
    expect(result.current.updatedAt).toBe(1000);
    act(() => { result.current.refresh(); result.current.refresh(); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe('first');
    expect(result.current.refreshing).toBe(true);
    clock.mockReturnValue(2000);
    await act(async () => next.resolve('second'));
    expect(result.current.data).toBe('second');
    expect(result.current.updatedAt).toBe(2000);
    expect(result.current.refreshing).toBe(false);
  });
  it('keeps the last successful timestamp on failure and recovers on retry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const failure = new Error('Disconnected');
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('cached').mockRejectedValueOnce(failure).mockResolvedValueOnce('recovered');
    const { result } = renderHook(() => useQuery(load, []), { wrapper: ApiProvider });
    await act(async () => {});
    await act(async () => result.current.refresh());
    expect(result.current.data).toBe('cached');
    expect(result.current.error).toBe(failure);
    expect(result.current.updatedAt).toBe(1000);
    await act(async () => result.current.refresh());
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('recovered');
  });
  it('hides the previous node immediately and ignores a late reply after navigation', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const third = deferred<string>();
    const loads = { a: first, b: second, c: third };
    const { result, rerender } = renderHook(({ id }: { id: keyof typeof loads }) => useQuery(() => loads[id].promise, [id]), {
      initialProps: { id: 'a' }, wrapper: ApiProvider,
    });
    await act(async () => first.resolve('node a'));
    expect(result.current.data).toBe('node a');
    rerender({ id: 'b' });
    expect(result.current.data).toBeUndefined();
    expect(result.current.updatedAt).toBeNull();
    rerender({ id: 'c' });
    await act(async () => second.resolve('late node b'));
    expect(result.current.data).toBeUndefined();
    await act(async () => third.resolve('node c'));
    expect(result.current.data).toBe('node c');
  });
  it('broadcast refresh reaches every mounted query', async () => {
    const one = vi.fn().mockResolvedValue('one');
    const two = vi.fn().mockResolvedValue('two');
    renderHook(() => ({ one: useQuery(one, []), two: useQuery(two, []) }), { wrapper: ApiProvider });
    await act(async () => {});
    await act(async () => refreshQueries());
    expect(one).toHaveBeenCalledTimes(2);
    expect(two).toHaveBeenCalledTimes(2);
  });
});
