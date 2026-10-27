import { useEffect, useState } from 'react';
import { describeFeed } from '../services/feedStatus';
import './data-feed-status.css';

export function DataFeedStatus({ mode, updatedAt, error, refreshing, onRefresh }: {
  mode: 'REAL' | 'SIMULATION'; updatedAt: number | null; error: Error | null;
  refreshing: boolean; onRefresh: () => void;
}) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const onConnection = () => { setOnline(navigator.onLine); if (navigator.onLine) onRefresh(); };
    window.addEventListener('online', onConnection);
    window.addEventListener('offline', onConnection);
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { window.removeEventListener('online', onConnection); window.removeEventListener('offline', onConnection); window.clearInterval(timer); };
  }, [onRefresh]);
  const status = describeFeed({ mode, online, updatedAt, error, now });
  return <div className="data-feed-status">
    <span role="status" className={`feed-${status.tone}`} title={status.detail}>{status.label}</span>
    <button type="button" className="btn" onClick={onRefresh} disabled={refreshing || (mode === 'REAL' && !online)}
      title="Refresh all data queries on the current screen">{refreshing ? 'Refreshing…' : 'Refresh data'}</button>
  </div>;
}
