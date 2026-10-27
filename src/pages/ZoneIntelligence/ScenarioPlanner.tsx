import { useState } from 'react';
import type { ZoneSummary } from '../../types';
import { Panel } from '../../components/ui';
import { calculateZoneScenario } from '../../services/zoneScenario';
import './scenario.css';

type PlannerZone = Pick<ZoneSummary, 'zone_id' | 'name' | 'supply_lps' | 'demand_lps' | 'loss_fraction'>;
const numeric = (value: string) => value.trim() === '' ? NaN : Number(value);
const flow = (value: number) => `${value.toFixed(1)} L/s`;

function PlannerInputs({ zone }: { zone: PlannerZone }) {
  const [supply, setSupply] = useState('0');
  const [demand, setDemand] = useState('0');
  const result = calculateZoneScenario(zone, numeric(supply), numeric(demand));
  return <Panel title="Demand scenario planner" subtitle={`Local what-if for ${zone.name} · percentage changes apply to current reported values`}>
    <div className="zone-scenario-controls">
      <label>Supply change (%)<input type="number" min={-100} max={200} step={1} value={supply} onChange={(event) => setSupply(event.target.value)} /></label>
      <label>Demand change (%)<input type="number" min={-100} max={200} step={1} value={demand} onChange={(event) => setDemand(event.target.value)} /></label>
      <button type="button" className="btn" onClick={() => { setSupply('0'); setDemand('0'); }}>Reset scenario</button>
    </div>
    {!result ? <p className="zone-scenario-error" role="alert">Scenario unavailable. Enter changes from −100% to +200%; reported supply and demand must be non-negative and inferred loss must be between 0% and 100%.</p> : <>
      <div className="zone-scenario-table-wrap"><table className="zone-scenario-table">
        <thead><tr><th scope="col">Water balance</th><th scope="col">Current baseline</th><th scope="col">Your scenario</th></tr></thead>
        <tbody>
          <tr><th scope="row">Gross supply</th><td>{flow(result.baseline.supply)}</td><td>{flow(result.scenario.supply)}</td></tr>
          <tr><th scope="row">Loss-adjusted supply</th><td>{flow(result.baseline.deliverable)}</td><td>{flow(result.scenario.deliverable)}</td></tr>
          <tr><th scope="row">Demand</th><td>{flow(result.baseline.demand)}</td><td>{flow(result.scenario.demand)}</td></tr>
          <tr><th scope="row">Balance after inferred losses</th><td>{flow(result.baseline.balance)}</td><td>{flow(result.scenario.balance)}</td></tr>
          <tr><th scope="row">Demand coverage</th><td>{result.baseline.coverage === null ? 'No demand' : `${(result.baseline.coverage * 100).toFixed(1)}%`}</td><td>{result.scenario.coverage === null ? 'No demand' : `${(result.scenario.coverage * 100).toFixed(1)}%`}</td></tr>
        </tbody>
      </table></div>
      <p className="zone-scenario-result" role="status">Scenario {result.scenario.balance >= 0 ? 'surplus' : 'deficit'}: {flow(Math.abs(result.scenario.balance))}.</p>
    </>}
    <p className="zone-scenario-note">Loss-adjusted supply = supply × (1 − inferred loss fraction); balance = loss-adjusted supply − demand. The loss fraction stays fixed{Number.isFinite(zone.loss_fraction) && zone.loss_fraction >= 0 && zone.loss_fraction <= 1 ? ` at ${(zone.loss_fraction * 100).toFixed(1)}%` : ''}. This is a local arithmetic scenario; it does not predict hydraulic response or change network settings. Live baseline readings may continue to update.</p>
  </Panel>;
}

/** Each zone gets a fresh set of inputs instead of inheriting another zone's scenario. */
export function ScenarioPlanner({ zone }: { zone: PlannerZone }) {
  return <PlannerInputs key={zone.zone_id} zone={zone} />;
}
