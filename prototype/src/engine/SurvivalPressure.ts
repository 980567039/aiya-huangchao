import type { GameState, NationalResources } from "./GameState";

/** V0.5 economy tuning. Keep these values in one place so balance iteration does not require rewriting the monthly loop. */
export const SURVIVAL_BALANCE = {
  populationFoodConsumption: 2,
  populationManpowerRecovery: 0.2,
  baseTreasuryAdministrationCost: 900,
  armyFoodConsumptionRate: 0.05,
  armyTreasuryUpkeepRate: 0.02,
} as const;

export interface SurvivalPressureDelta {
  food: number;
  treasury: number;
  manpower: number;
}

/**
 * Fixed monthly pressure that exists even when the emperor builds nothing.
 * Province production is calculated elsewhere; this layer represents the
 * unavoidable cost of feeding the population, maintaining the state, and
 * gradually refreshing the labor pool.
 */
export function calculateSurvivalPressure(state: Pick<GameState, "resources" | "provinces">): SurvivalPressureDelta {
  const population = state.provinces.reduce((sum, province) => sum + province.population, 0);
  return {
    food: -Math.ceil(population * SURVIVAL_BALANCE.populationFoodConsumption)
      - Math.ceil(state.resources.army * SURVIVAL_BALANCE.armyFoodConsumptionRate),
    treasury: -SURVIVAL_BALANCE.baseTreasuryAdministrationCost
      - Math.ceil(state.resources.army * SURVIVAL_BALANCE.armyTreasuryUpkeepRate),
    manpower: Math.floor(population * SURVIVAL_BALANCE.populationManpowerRecovery),
  };
}

export function applySurvivalPressure(resources: NationalResources, pressure: SurvivalPressureDelta): NationalResources {
  return {
    ...resources,
    food: Math.max(0, resources.food + pressure.food),
    treasury: Math.max(0, resources.treasury + pressure.treasury),
    manpower: Math.max(0, resources.manpower + pressure.manpower),
  };
}
