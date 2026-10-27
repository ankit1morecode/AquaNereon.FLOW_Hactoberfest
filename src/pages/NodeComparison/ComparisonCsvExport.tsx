import { useState } from 'react';
import type { NodeSummary } from '../../types';
import { downloadComparisonCsv, type ComparisonSource } from '../../services/comparisonCsv';

export function ComparisonCsvExport({ nodes, source, error }: { nodes: NodeSummary[]; source: ComparisonSource; error: Error | null }) {
  const [notice, setNotice] = useState('');
  return <div className="comparison-csv-export">
    <button type="button" className="btn" disabled={Boolean(error) || nodes.length < 2} onClick={() => {
      if (error || nodes.length < 2) return;
      try { downloadComparisonCsv(nodes, source); setNotice(`Exported ${Math.min(nodes.length, 3)} comparison rows from ${source.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE'} data.`); }
      catch { setNotice('Could not export the comparison. Please try again.'); }
    }}>Export comparison CSV</button>
    <span className="node-results"> Selected loaded rows only · first node is the reference · source timestamps retained</span>
    {notice && <p className="node-results" role="status">{notice}</p>}
  </div>;
}
