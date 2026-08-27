export { newGame } from "../data/seedData";
export {
  BUILDING_IDS,
  type BuildingId,
  type BuildingState,
} from "./GameState";
export type {
  CrisisStage,
  CrisisState,
  CrisisType,
  EndingReason,
  EndingState,
  GameState,
  HistoryEntry,
  NationalResources,
  ProvinceState,
  FactionState,
} from "./GameState";
export {
  BUILDING_DEFINITIONS,
  buildBuilding,
  canBuild,
  calculateBuildingResourceDelta,
  constructBuilding,
  getBuildingDefinition,
} from "./Buildings";
export type {
  BuildCheck,
  BuildFailureReason,
  BuildingDefinition,
  ResourceDelta,
} from "./Buildings";
export {
  advanceMonth,
  calculateCrisisPressure,
  calculateProvinceProduction,
  centralCollectionEfficiency,
  formatReignDate,
  settleMonthlyEconomy,
  settleMonthlyEconomyDetailed,
  updateCrisis,
} from "./MonthlyLoop";
export type { CrisisPressure, MonthlyEconomyResult, ProvinceProduction } from "./MonthlyLoop";
export {
  EVENT_DEFINITIONS,
  drawMonthlyEvent,
  eventRandom,
  getEventDefinition,
  getPendingEvent,
  resolveEvent,
  resolveMemorial,
  chooseMemorial,
} from "./EventEngine";
export type { EventDefinition, MonthlyEventResult } from "./EventEngine";
