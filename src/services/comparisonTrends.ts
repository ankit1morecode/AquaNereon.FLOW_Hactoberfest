import type { ApiClient } from './client';
import type { FlowSignature } from '../types';
import type { Series } from '../components/charts';

export const COMPARISON_HISTORY_LIMIT = 90;
export type ComparisonMetric = 'baseline' | 'flow' | 'pressure';
export interface ComparisonHistory {
  nodeId: string;
  signatures: FlowSignature[];
  omitted: number;
  error: string | null;
}

/** Keep each node's recorded timestamps; a partial failure cannot replace another series. */
export async function loadComparisonHistory(client: Pick<ApiClient, 'getNodeSignatureHistory'>, ids: string[]): Promise<ComparisonHistory[]> {
  const unique = [...new Set(ids)].filter(Boolean).slice(0, 3);
  const results = await Promise.allSettled(unique.map(async (id) => client.getNodeSignatureHistory(id, COMPARISON_HISTORY_LIMIT)));
  return results.map((result, index) => {
    const nodeId = unique[index];
    if (result.status === 'rejected') return { nodeId, signatures: [], omitted: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
    if (!Array.isArray(result.value)) return { nodeId, signatures: [], omitted: 0, error: 'History response is unavailable.' };
    const valid = result.value.filter((signature) => signature.node_id === nodeId && Number.isFinite(Date.parse(signature.timestamp)))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    return { nodeId, signatures: valid.slice(-COMPARISON_HISTORY_LIMIT), omitted: result.value.length - valid.length, error: null };
  });
}

export function comparisonTrendSeries(history: ComparisonHistory[], metric: ComparisonMetric): Series[] {
  return history.map((entry, index) => ({
    id: entry.nodeId,
    label: `${entry.nodeId}${index === 0 ? ' (reference)' : ''}`,
    color: ['var(--a)', 'var(--b)', '#b4a1f7'][index % 3],
    points: entry.signatures.map((signature) => ({ x: Date.parse(signature.timestamp),
      y: metric === 'baseline' ? signature.baseline_distance : metric === 'flow' ? signature.hydraulic?.flow_mean : signature.hydraulic?.pressure_mean,
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  }));
}
