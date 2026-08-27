import {
  calculateProvinceProduction,
  centralCollectionEfficiency,
  advanceMonth as settleMonth,
} from "./MonthlyLoop";
import { BUILDING_DEFINITIONS } from "./Buildings";
import type { FactionId, GameState } from "./GameState";

export interface FoodShortageResult {
  shortage: number;
  peasantLoss: number;
  soldierLoss: number;
  peasantSatisfactionLoss: number;
  militarySatisfactionLoss: number;
}

/**
 * Resolve monthly food pressure after the normal economic settlement.
 *
 * Food is consumed by both the standing army and every capital barracks level.
 * If the food available before upkeep cannot cover those costs, the shortfall
 * becomes a famine/shortrage consequence instead of being silently absorbed by
 * clamping the stockpile to zero.
 */
export function calculateFoodShortage(state: GameState): FoodShortageResult {
  const production = calculateProvinceProduction(state);
  const collectedFood = Math.round(
    production.reduce((sum, item) => sum + item.food, 0) * centralCollectionEfficiency(state),
  );
  const buildingFoodProduction = state.buildings.reduce((sum, building) => {
    const definition = BUILDING_DEFINITIONS[building.id];
    return sum + (definition?.monthlyProduction.food ?? 0) * building.level;
  }, 0);
  const barracksFoodUpkeep = state.buildings.reduce((sum, building) => {
    const definition = BUILDING_DEFINITIONS[building.id];
    return sum + (definition?.monthlyUpkeep.food ?? 0) * building.level;
  }, 0);
  const armyFoodUpkeep = Math.ceil(state.resources.army * 0.05);
  const available = state.resources.food + collectedFood + buildingFoodProduction;
  const required = armyFoodUpkeep + barracksFoodUpkeep;
  const shortage = Math.max(0, required - available);
  if (shortage <= 0) {
    return { shortage: 0, peasantLoss: 0, soldierLoss: 0, peasantSatisfactionLoss: 0, militarySatisfactionLoss: 0 };
  }

  // Population is stored in compact "万" units in the prototype. Severe food
  // shortage therefore removes whole population units rather than pretending
  // to simulate individual households.
  const peasantLoss = Math.min(
    Math.max(0, state.provinces.reduce((sum, province) => sum + province.population, 0) - 1),
    Math.max(1, Math.ceil(shortage / 10_000)),
  );
  const soldierLoss = Math.min(
    state.resources.army,
    Math.max(1, Math.ceil(shortage / 80)),
  );
  const severity = Math.min(8, Math.max(1, Math.ceil(shortage / 5_000)));

  return {
    shortage,
    peasantLoss,
    soldierLoss,
    peasantSatisfactionLoss: Math.min(12, 4 + severity),
    militarySatisfactionLoss: Math.min(10, 3 + Math.ceil(severity * 0.75)),
  };
}

function applyFactionLoss(
  factions: GameState["factions"],
  id: FactionId,
  satisfactionLoss: number,
): GameState["factions"] {
  return factions.map((faction) => faction.id === id
    ? {
        ...faction,
        satisfaction: Math.max(0, faction.satisfaction - satisfactionLoss),
        resentment: faction.resentment + Math.ceil(satisfactionLoss / 2),
      }
    : faction);
}

/** Advance a month and then apply explicit starvation consequences. */
export function advanceMonthWithFood(state: GameState, random?: (seed: number) => number): GameState {
  if (state.ending) return state;
  const shortage = calculateFoodShortage(state);
  let next = settleMonth(state, random);
  if (shortage.shortage <= 0 || next.ending) return next;

  const provinces = [...next.provinces];
  let remainingPopulationLoss = shortage.peasantLoss;
  for (let index = 0; index < provinces.length && remainingPopulationLoss > 0; index += 1) {
    const province = provinces[index];
    const loss = Math.min(Math.max(0, province.population - 1), remainingPopulationLoss);
    if (loss <= 0) continue;
    provinces[index] = {
      ...province,
      population: province.population - loss,
      morale: Math.max(0, province.morale - 3),
      rebellionRisk: Math.min(100, province.rebellionRisk + 3),
    };
    remainingPopulationLoss -= loss;
  }

  const resources = {
    ...next.resources,
    army: Math.max(0, next.resources.army - shortage.soldierLoss),
    food: 0,
  };
  const factions = applyFactionLoss(
    applyFactionLoss(next.factions, "peasants", shortage.peasantSatisfactionLoss),
    "military",
    shortage.militarySatisfactionLoss,
  );
  const history = [...next.history];
  const last = history[history.length - 1];
  if (last) {
    history[history.length - 1] = {
      ...last,
      actions: [
        ...last.actions,
        `粮荒：军民缺粮 ${shortage.shortage}，损失农民 ${shortage.peasantLoss} 万、士兵 ${shortage.soldierLoss} 人`,
        `粮荒导致百姓满意度 -${shortage.peasantSatisfactionLoss}、武将满意度 -${shortage.militarySatisfactionLoss}`,
      ],
      shortages: [...(last.shortages ?? []), "food", "army", "peasants"],
    };
  }

  return { ...next, resources, provinces, factions, history };
}
