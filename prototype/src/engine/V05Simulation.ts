import { newGame } from "../data/seedData";
import { advanceMonth } from "./MonthlyLoop";
import type { GameState } from "./GameState";

export interface SimulationSnapshot {
  totalMonths: number;
  year: number;
  month: number;
  treasury: number;
  food: number;
  weapons: number;
  army: number;
  manpower: number;
  authority: number;
  morale: number;
  lowestFactionSatisfaction: number;
  crisisPressure: number;
  ending: GameState["ending"];
}

export interface SimulationResult {
  initial: SimulationSnapshot;
  months: SimulationSnapshot[];
  final: SimulationSnapshot;
}

function snapshot(state: GameState): SimulationSnapshot {
  return {
    totalMonths: state.time.totalMonths,
    year: state.time.year,
    month: state.time.month,
    treasury: Math.round(state.resources.treasury),
    food: Math.round(state.resources.food),
    weapons: Math.round(state.resources.weapons),
    army: Math.round(state.resources.army),
    manpower: Math.round(state.resources.manpower),
    authority: Math.round(state.resources.authority * 100) / 100,
    morale: Math.round(state.resources.morale * 100) / 100,
    lowestFactionSatisfaction: Math.min(...state.factions.map((faction) => faction.satisfaction)),
    crisisPressure: Math.round((state.crisis?.pressure ?? 0) * 100) / 100,
    ending: state.ending,
  };
}

/**
 * Run the same monthly loop used by the game UI with no player construction
 * and a deterministic event randomizer. This is intentionally an integration
 * simulation rather than a mock economy calculation.
 */
export function simulateV05Months(months = 12, seed = 17): SimulationResult {
  let state = newGame();
  const initial = snapshot(state);
  const snapshots: SimulationSnapshot[] = [];

  const random = (input: number): number => {
    const x = Math.sin(seed + input * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let index = 0; index < months && !state.ending; index += 1) {
    state = advanceMonth(state, random);
    snapshots.push(snapshot(state));
  }

  return {
    initial,
    months: snapshots,
    final: snapshots[snapshots.length - 1] ?? initial,
  };
}
