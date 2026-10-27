/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComparisonTrends } from '../src/pages/NodeComparison/ComparisonTrends';
import { COMPARISON_HISTORY_LIMIT, comparisonTrendSeries, loadComparisonHistory, type ComparisonHistory } from '../src/services/comparisonTrends';
import type { FlowSignature } from '../src/types';
import type { Series } from '../src/components/charts';

const fixture = vi.hoisted(() => ({ history: [] as ComparisonHistory[] }));
vi.mock('../src/services/ApiProvider', () => ({ useApi: () => ({ mode: 'SIMULATION' }), useQuery: () => ({ data: fixture.history, error: null }) }));
vi.mock('../src/components/charts', () => ({ TimeSeriesChart: ({ series, ariaLabel }: { series: Series[]; ariaLabel: string }) => <div role="img" aria-label={ariaLabel}>{JSON.stringify(series)}</div> }));
afterEach(cleanup);
function signature(node: string, stamp: string, baseline = .2): FlowSignature {
  return { node_id: node, timestamp: stamp, baseline_distance: baseline, hydraulic: { flow_mean: 20, pressure_mean: 300 }, data_quality: { stale: false } } as FlowSignature;
}

describe('comparison trends', () => {
  it('retains the requested node identity and partial API failures', async () => {
    const request = vi.fn(async (id: string) => {
      if (id === 'B') throw new Error('Disconnected');
      return [signature('wrong-node', '2026-10-27T10:00:00Z'), signature('A', 'invalid'), signature('A', '2026-10-27T10:01:00Z')];
    });
    const result = await loadComparisonHistory({ getNodeSignatureHistory: request }, ['A', 'B']);
    expect(request).toHaveBeenCalledWith('A', COMPARISON_HISTORY_LIMIT);
    expect(result[0].signatures).toHaveLength(1);
    expect(result[0].omitted).toBe(2);
    expect(result[1]).toMatchObject({ nodeId: 'B', signatures: [], error: 'Disconnected' });
  });
  it('bounds and sorts loaded history while aligning nodes by their actual timestamps', async () => {
    const values = Array.from({ length: 110 }, (_, index) => signature('A', new Date(index * 1000).toISOString()));
    const history = await loadComparisonHistory({ getNodeSignatureHistory: async () => [...values].reverse() }, ['A']);
    expect(history[0].signatures).toHaveLength(90);
    const series = comparisonTrendSeries([...history, { nodeId: 'B', error: null, omitted: 0, signatures: [signature('B', new Date(120_000).toISOString())] }], 'baseline');
    expect(series[0].points[0].x).toBe(20_000);
    expect(series[1].points[0].x).toBe(120_000);
    expect(values).toHaveLength(110);
  });
  it('skips nonfinite metric values without inventing replacement samples', () => {
    const history = [{ nodeId: 'A', error: null, omitted: 0, signatures: [signature('A', '2026-10-27T10:00:00Z', NaN)] }];
    expect(comparisonTrendSeries(history, 'baseline')[0].points).toEqual([]);
    expect(comparisonTrendSeries(history, 'flow')[0].points[0].y).toBe(20);
  });
  it('switches metrics and explains failed series alongside usable data', () => {
    fixture.history = [{ nodeId: 'A', error: null, omitted: 0, signatures: [signature('A', '2026-10-27T10:00:00Z')] }, { nodeId: 'B', error: 'Disconnected', omitted: 0, signatures: [] }];
    render(<ComparisonTrends ids={['A', 'B']} />);
    expect(screen.getByRole('img', { name: 'Baseline distance comparison by recorded timestamp' })).toBeTruthy();
    expect(screen.getByText(/History unavailable: Disconnected/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Trend metric'), { target: { value: 'pressure' } });
    expect(screen.getByRole('img', { name: 'Mean pressure comparison by recorded timestamp' }).textContent).toContain('300');
  });
});
