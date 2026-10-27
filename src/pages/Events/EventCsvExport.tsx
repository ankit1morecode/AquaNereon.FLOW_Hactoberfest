import { useState } from 'react';
import type { WaterEvent } from '../../types';
import { downloadEventsCsv } from '../../services/eventCsv';

export function EventCsvExport({ events }: { events: WaterEvent[] }) {
  const [message, setMessage] = useState('');
  return <>
    <button className="btn" type="button" disabled={events.length === 0} onClick={() => {
      try { downloadEventsCsv(events); setMessage(`Exported ${events.length} matching events.`); }
      catch { setMessage('The browser could not download this CSV. Try again.'); }
    }}>Export CSV ({events.length})</button>
    {message && <p className="event-tools-summary" role="status">{message}</p>}
  </>;
}
