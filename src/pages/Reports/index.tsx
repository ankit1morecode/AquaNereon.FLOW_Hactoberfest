import { useMemo, useState } from 'react';
import { useApi, useQuery } from '../../services/ApiProvider';
import { filterReportEvents, reportFilterError, reportStatistics } from '../../services/reportFilters';
import { buildIncidentHandoff } from '../../services/incidentHandoff';
import { IncidentAnalytics } from './IncidentAnalytics';
import { PeriodComparison } from './PeriodComparison';
import './reports.css';
import { EventTimeline } from '../../components/EventTimeline';
import { BarRow, TimeSeriesChart } from '../../components/charts';
import {
  Empty,
  ErrorNote,
  Loading,
  Meter,
  Metric,
  MetricGrid,
  Panel,
  STATE_CLASS,
  STATE_LABEL,
  clockTime,
} from '../../components/ui';

/**
 * Reports.
 *
 * Historical events, interventions, forecast performance and verification —
 * the closing half of the dossier's loop, which is the half normally left out.
 * A platform that raises events and never says whether the intervention worked
 * has no way to earn trust, so the verification column here is the one that
 * matters most even though it is the least dramatic.
 */

function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadJson(name: string, data: unknown): void {
  downloadFile(name, JSON.stringify(data, null, 2), 'application/json');
}

export function Reports() {
  const client = useApi();
  const [window, setWindow] = useState<'session' | 'closed' | 'open'>('session');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const events = useQuery((c) => c.getEvents({ limit: 200 }), []);
  const recommendations = useQuery((c) => c.getRecommendations(), []);
  const forecasts = useQuery((c) => c.getForecasts({ scope: 'ZONE' }), []);
  const zones = useQuery((c) => c.getZones(), []);
  const nodes = useQuery((c) => c.getNodes(), []);

  const all = events.data?.items ?? [];

  const filterError = reportFilterError({ status: window, startDate, endDate });
  const filtered = useMemo(
    () => filterReportEvents(all, { status: window, startDate, endDate }),
    [all, window, startDate, endDate],
  );
  const stats = useMemo(() => reportStatistics(filtered), [filtered]);
  const filteredRecommendations = (recommendations.data ?? []).filter(
    (recommendation) => recommendation.event_id && filtered.some(
      (event) => event.event_id === recommendation.event_id,
    ),
  );

  if (events.error) return <ErrorNote error={events.error} />;
  if (!events.data) return <Loading what="reports" />;
  const availableCount = events.data.total;

  const maxType = Math.max(1, ...stats.byType.map(([, n]) => n));
  const maxNode = Math.max(1, ...stats.byNode.map(([, n]) => n));

  return (
    <div className="page reports-page">
      <Panel title="Report scope" subtitle="Event dates use your local timezone. Forecast performance below is the latest available backtest.">
        <div className="rp-filter-controls">
          <label>From date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-describedby="rp-filter-feedback" /></label>
          <label>Through date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-describedby="rp-filter-feedback" /></label>
          <button type="button" className="btn" onClick={() => { setStartDate(''); setEndDate(''); setWindow('session'); }}>Clear filters</button>
        </div>
        {filterError && <p className="rp-filter-error" role="alert">{filterError}</p>}
        <p className="rp-note" id="rp-filter-feedback" role="status">
          {filtered.length} matching events from {all.length} loaded of {events.data.total} available (load limit: 200).
          {events.data.total > all.length && ' This report covers the loaded subset only.'}
        </p>
      </Panel>
      <div className="rp-strip">
        <Panel className="kpi">
          <MetricGrid columns={4}>
            <Metric label="Events raised" value={stats.total} />
            <Metric label="Interventions" value={stats.intervened} />
            <Metric label="Closed" value={stats.closed} />
            <Metric
              label="Verified"
              value={stats.verified}
              tone={stats.verificationRate < 0.6 && stats.closed > 0 ? 'warn' : 'ok'}
              hint="Closed events that completed post-intervention verification sampling."
            />
          </MetricGrid>
          <div className="kpi-loss">
            <span>Verification rate</span>
            <Meter
              value={stats.verificationRate}
              tone={stats.verificationRate > 0.7 ? 'ok' : 'warn'}
            />
            <b>{Math.round(stats.verificationRate * 100)}%</b>
          </div>
        </Panel>

        <Panel title="Events by type" className="rp-bars">
          {stats.byType.length === 0 ? (
            <Empty>No events match this report scope.</Empty>
          ) : (
            stats.byType.map(([type, n]) => (
              <BarRow
                key={type}
                label={type.replace(/_/g, ' ').toLowerCase()}
                value={n}
                max={maxType}
                caption={String(n)}
              />
            ))
          )}
        </Panel>

        <Panel title="Most active nodes" className="rp-bars">
          {stats.byNode.length === 0 ? (
            <Empty>No events match this report scope.</Empty>
          ) : (
            stats.byNode.map(([id, n]) => {
              const node = nodes.data?.find((x) => x.node_id === id);
              return (
                <BarRow
                  key={id}
                  label={
                    <span className={node ? STATE_CLASS[node.state] : undefined}>{id}</span>
                  }
                  value={n}
                  max={maxNode}
                  color="var(--state-pre)"
                  caption={node ? STATE_LABEL[node.state] : String(n)}
                />
              );
            })
          )}
        </Panel>
      </div>

      <IncidentAnalytics events={filtered} zones={zones.data ?? []} />
      <PeriodComparison events={all} filters={{ status: window, startDate, endDate }} availableCount={availableCount} />

      <div className="rp-main">
        <Panel
          title="Event history"
          subtitle="Chronological, with intervention and verification identifiers"
          actions={
            <div className="rp-actions">
              <div className="seg">
                {(['session', 'open', 'closed'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={window === w ? 'seg-btn active' : 'seg-btn'}
                    onClick={() => setWindow(w)}
                    aria-pressed={window === w}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn"
                disabled={filtered.length === 0 || !!filterError}
                onClick={() =>
                  downloadJson(
                    `aquanereon-events-${new Date().toISOString().slice(0, 10)}.json`,
                    filtered,
                  )
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn"
                disabled={filtered.length === 0 || !!filterError || !recommendations.data || !!recommendations.error}
                title={recommendations.error ? 'Recommendations could not be loaded; retry before exporting a complete handoff.' : 'Download selected incidents, evidence, recommendations and verification references as Markdown'}
                onClick={() => downloadFile(
                  `aquanereon-handoff-${new Date().toISOString().slice(0, 10)}.md`,
                  buildIncidentHandoff({
                    events: filtered,
                    recommendations: recommendations.data ?? [],
                    source: { mode: client.mode, label: client.label },
                    filters: { status: window, startDate, endDate },
                    loadedCount: all.length,
                    availableCount,
                  }),
                  'text/markdown;charset=utf-8',
                )}
              >
                Export incident handoff
              </button>
            </div>
          }
          scroll
        >
          <EventTimeline events={filtered} chronological emptyNote="No events match this report scope." />
        </Panel>

        <div className="rp-side">
          <Panel title="Forecast performance" subtitle="Backtest error by zone">
            {(forecasts.data ?? []).length === 0 ? (
              <Loading what="forecasts" />
            ) : (
              <>
                {(forecasts.data ?? []).map((f) => {
                  const zone = zones.data?.find((z) => z.zone_id === f.target_id);
                  return (
                    <BarRow
                      key={f.forecast_id}
                      label={zone?.name ?? f.target_id}
                      value={f.backtest_mape}
                      max={12}
                      color={f.backtest_mape > 8 ? 'var(--state-pre)' : 'var(--state-stable)'}
                      caption={`${f.backtest_mape.toFixed(1)}% MAPE`}
                    />
                  );
                })}
                {forecasts.data?.[0] && (
                  <TimeSeriesChart
                    height={140}
                    unit=" L/s"
                    legend={false}
                    series={forecasts.data.map((f, i) => ({
                      id: f.forecast_id,
                      label: f.target_id,
                      color: ['var(--a)', 'var(--b)', 'var(--state-stable)'][i % 3],
                      points: f.forecast.map((p, k) => ({ x: k, y: p.v })),
                    }))}
                    yFormat={(v) => v.toFixed(0)}
                    xFormat={(v) =>
                      clockTime(
                        new Date(
                          new Date(forecasts.data![0].issued_at).getTime() + v * 3600_000,
                        ).toISOString(),
                      )
                    }
                    ariaLabel="Zone forecasts over the next 24 hours"
                  />
                )}
                <p className="rp-note">
                  MAPE is measured against the last completed horizon. A forecast that has
                  not yet been backtested shows no figure rather than a flattering one.
                </p>
              </>
            )}
          </Panel>

          <Panel title="Interventions" subtitle="Recommended, accepted and verified" scroll>
            {filteredRecommendations.length === 0 ? (
              <Empty>No interventions linked to the selected events.</Empty>
            ) : (
              <ul className="rec-list compact">
                {filteredRecommendations.map((rec) => (
                  <li key={rec.recommendation_id}>
                    <div className="rec-head">
                      <span className={`rec-prio p${rec.priority}`}>P{rec.priority}</span>
                      <code>{rec.node_id ?? rec.zone_id}</code>
                      <span className="rec-status">{rec.status.toLowerCase()}</span>
                    </div>
                    <p className="rec-action">{rec.action}</p>
                    <p className="rec-verify">
                      <strong>Verify:</strong> {rec.verification}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
