import { useState } from 'react';
import type { DemandForecast } from '../../types';
import { downloadZoneForecastCsv, type ForecastSource } from '../../services/zoneForecastCsv';
import './forecast-export.css';

export function ForecastExport({ forecast, zoneId, source, error }: {
  forecast: DemandForecast | undefined;
  zoneId: string;
  source: ForecastSource;
  error: Error | null;
}) {
  const [notice, setNotice] = useState('');
  const available = !error && forecast?.scope === 'ZONE' && forecast.target_id === zoneId && forecast.forecast.length > 0;
  return <div className="zone-forecast-export">
    <button type="button" className="btn" disabled={!available}
      title={error ? 'Export is unavailable while the forecast has an error' : 'Download the loaded zone forecast, intervals, history and source metadata'}
      onClick={() => {
        if (!available || !forecast) return;
        try {
          downloadZoneForecastCsv(forecast, source);
          setNotice(`Exported ${forecast.forecast.length} forecast points and ${forecast.history.length} history points for ${zoneId}.`);
        } catch { setNotice('Could not export the forecast. Please try again.'); }
      }}>Export forecast CSV</button>
    {notice && <span role="status">{notice}</span>}
  </div>;
}
