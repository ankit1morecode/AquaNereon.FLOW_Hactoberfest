import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformSimulator } from '../src/services/platformSimulator';
afterEach(() => vi.restoreAllMocks());

describe('simulation incident identity', () => {
  it('keeps persistent incident metadata separate across runs at the same wall clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const first = new PlatformSimulator();
    const second = new PlatformSimulator();
    for (let step = 0; step < 240; step++) { first.tick(1); second.tick(1); }
    const firstIds = first.allEvents().map((event) => event.event_id);
    const secondIds = second.allEvents().map((event) => event.event_id);
    expect(firstIds.length).toBeGreaterThan(0);
    expect(secondIds.length).toBe(firstIds.length);
    expect(new Set(firstIds).size).toBe(firstIds.length);
    expect(new Set(secondIds).size).toBe(secondIds.length);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    expect(first.allEvents().map((event) => event.node_id)).toEqual(second.allEvents().map((event) => event.node_id));
  });
});
