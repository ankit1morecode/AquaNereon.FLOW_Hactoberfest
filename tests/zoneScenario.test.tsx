/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { calculateZoneScenario } from '../src/services/zoneScenario';
import { ScenarioPlanner } from '../src/pages/ZoneIntelligence/ScenarioPlanner';

afterEach(cleanup);
const base = { zone_id: 'Z-ONE', name: 'First zone', supply_lps: 100, demand_lps: 80, loss_fraction: 0.1 };
describe('local zone scenario planner', () => {
  it('keeps inferred loss fixed and applies both percentage changes in the stated units', () => {
    const result = calculateZoneScenario(base, 20, 25)!;
    expect(result.baseline).toEqual({ supply: 100, deliverable: 90, demand: 80, balance: 10, coverage: 1.125 });
    expect(result.scenario).toEqual({ supply: 120, deliverable: 108, demand: 100, balance: 8, coverage: 1.08 });
    expect(base.supply_lps).toBe(100);
  });
  it('handles zero supply, zero demand and complete inferred losses without division errors', () => {
    expect(calculateZoneScenario(base, -100, -100)?.scenario).toEqual({ supply: 0, deliverable: 0, demand: 0, balance: 0, coverage: null });
    expect(calculateZoneScenario({ ...base, loss_fraction: 1 }, 0, 0)?.scenario.balance).toBe(-80);
    expect(calculateZoneScenario({ ...base, supply_lps: 0 }, 0, 0)?.scenario.coverage).toBe(0);
  });
  it('rejects unsupported changes and invalid source values rather than inventing a balance', () => {
    for (const change of [-101, 201, NaN, Infinity]) expect(calculateZoneScenario(base, change, 0)).toBeNull();
    expect(calculateZoneScenario({ ...base, supply_lps: Number.MAX_VALUE }, 200, 0)).toBeNull();
    for (const invalid of [{ supply_lps: -1 }, { demand_lps: NaN }, { loss_fraction: 1.1 }, { loss_fraction: -0.1 }]) {
      expect(calculateZoneScenario({ ...base, ...invalid }, 0, 0)).toBeNull();
    }
  });
  it('updates the displayed scenario and resets to the latest live baseline', () => {
    const view = render(<ScenarioPlanner zone={base} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Demand change (%)' }), { target: { value: '50' } });
    expect(screen.getByRole('status').textContent).toBe('Scenario deficit: 30.0 L/s.');
    view.rerender(<ScenarioPlanner zone={{ ...base, supply_lps: 200 }} />);
    expect(screen.getByRole('status').textContent).toBe('Scenario surplus: 60.0 L/s.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));
    expect(screen.getByRole('status').textContent).toBe('Scenario surplus: 100.0 L/s.');
  });
  it('clears inputs when changing zones and explains missing inputs', () => {
    const view = render(<ScenarioPlanner zone={base} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Supply change (%)' }), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toContain('Scenario unavailable');
    view.rerender(<ScenarioPlanner zone={{ ...base, zone_id: 'Z-TWO', name: 'Second zone' }} />);
    expect((screen.getByRole('spinbutton', { name: 'Supply change (%)' }) as HTMLInputElement).value).toBe('0');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
