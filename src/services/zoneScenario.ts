import type { ZoneSummary } from '../types';

export interface ScenarioBalance {
  supply: number;
  deliverable: number;
  demand: number;
  balance: number;
  /** Ratio of loss-adjusted supply to demand; absent when demand is zero. */
  coverage: number | null;
}
export interface ZoneScenario { baseline: ScenarioBalance; scenario: ScenarioBalance }
type ScenarioBase = Pick<ZoneSummary, 'supply_lps' | 'demand_lps' | 'loss_fraction'>;

/** A static, local water balance with a fixed inferred loss fraction. */
export function calculateZoneScenario(base: ScenarioBase, supplyChangePercent: number, demandChangePercent: number): ZoneScenario | null {
  if (![base.supply_lps, base.demand_lps, base.loss_fraction, supplyChangePercent, demandChangePercent].every(Number.isFinite)
    || base.supply_lps < 0 || base.demand_lps < 0 || base.loss_fraction < 0 || base.loss_fraction > 1
    || supplyChangePercent < -100 || supplyChangePercent > 200 || demandChangePercent < -100 || demandChangePercent > 200) return null;
  const balance = (supply: number, demand: number): ScenarioBalance => {
    const deliverable = supply * (1 - base.loss_fraction);
    return { supply, deliverable, demand, balance: deliverable - demand, coverage: demand > 0 ? deliverable / demand : null };
  };
  const result = {
    baseline: balance(base.supply_lps, base.demand_lps),
    scenario: balance(base.supply_lps * (1 + supplyChangePercent / 100), base.demand_lps * (1 + demandChangePercent / 100)),
  };
  return [result.baseline, result.scenario].every((value) =>
    [value.supply, value.deliverable, value.demand, value.balance].every(Number.isFinite)
      && (value.coverage === null || Number.isFinite(value.coverage))) ? result : null;
}
