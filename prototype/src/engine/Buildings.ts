import rawBuildings from "../../../data/buildings.json";
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingState,
  type GameState,
  type NationalResources,
  type ProvinceId,
} from "./GameState";

export type ResourceDelta = Partial<Record<keyof NationalResources, number>>;

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  icon: string;
  tone: "gold" | "red" | "green";
  maxLevel: number;
  constructionCost: ResourceDelta;
  monthlyProduction: ResourceDelta;
  monthlyUpkeep: ResourceDelta;
}

type RawBuilding = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tone: "gold" | "red" | "green";
  max_level: number;
  construction_cost: ResourceDelta;
  monthly_production: ResourceDelta;
  monthly_upkeep: ResourceDelta;
};

const rawBuildingList = rawBuildings.buildings as RawBuilding[];

function asBuildingId(id: string): BuildingId {
  if (!BUILDING_IDS.includes(id as BuildingId)) {
    throw new Error(`Unknown building id in data/buildings.json: ${id}`);
  }
  return id as BuildingId;
}

/** Building balance is configured in data/buildings.json; this module only normalizes it for the engine. */
export const BUILDING_DEFINITIONS: Record<BuildingId, BuildingDefinition> = Object.fromEntries(
  rawBuildingList.map((building) => [
    asBuildingId(building.id),
    {
      id: asBuildingId(building.id),
      name: building.name,
      description: building.description,
      icon: building.icon,
      tone: building.tone,
      maxLevel: building.max_level,
      constructionCost: building.construction_cost,
      monthlyProduction: building.monthly_production,
      monthlyUpkeep: building.monthly_upkeep,
    },
  ]),
) as Record<BuildingId, BuildingDefinition>;

export type BuildFailureReason =
  | "game_ended"
  | "unknown_building"
  | "province_not_found"
  | "max_level"
  | "insufficient_resources";

export interface BuildCheck {
  ok: boolean;
  reason?: BuildFailureReason;
  cost: ResourceDelta;
  nextLevel: number;
  definition?: BuildingDefinition;
}

function scaleDelta(delta: ResourceDelta, multiplier: number): ResourceDelta {
  return Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, (value ?? 0) * multiplier])) as ResourceDelta;
}

function hasResources(resources: NationalResources, cost: ResourceDelta): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as keyof NationalResources] >= (value ?? 0));
}

export function getBuildingDefinition(id: BuildingId | string): BuildingDefinition | undefined {
  return BUILDING_IDS.includes(id as BuildingId) ? BUILDING_DEFINITIONS[id as BuildingId] : undefined;
}

export function canBuild(
  state: Pick<GameState, "resources" | "buildings" | "provinces" | "ending">,
  id: BuildingId,
  provinceId: ProvinceId = "central",
): BuildCheck {
  const definition = getBuildingDefinition(id);
  if (!definition) return { ok: false, reason: "unknown_building", cost: {}, nextLevel: 1 };
  const existing = state.buildings.find((building) => building.id === id && building.provinceId === provinceId);
  const nextLevel = (existing?.level ?? 0) + 1;
  const cost = scaleDelta(definition.constructionCost, nextLevel);
  if (state.ending) return { ok: false, reason: "game_ended", cost, nextLevel, definition };
  if (!state.provinces.some((province) => province.id === provinceId)) return { ok: false, reason: "province_not_found", cost, nextLevel, definition };
  if (nextLevel > definition.maxLevel) return { ok: false, reason: "max_level", cost, nextLevel, definition };
  if (!hasResources(state.resources, cost)) return { ok: false, reason: "insufficient_resources", cost, nextLevel, definition };
  return { ok: true, cost, nextLevel, definition };
}

export function buildBuilding(state: GameState, id: BuildingId, provinceId: ProvinceId = "central"): GameState {
  const check = canBuild(state, id, provinceId);
  if (!check.ok || !check.definition) return state;

  const resources = { ...state.resources };
  for (const [key, value] of Object.entries(check.cost)) {
    resources[key as keyof NationalResources] -= value ?? 0;
  }

  const existingIndex = state.buildings.findIndex((building) => building.id === id && building.provinceId === provinceId);
  const buildings = [...state.buildings];
  if (existingIndex === -1) buildings.push({ id, provinceId, level: check.nextLevel });
  else buildings[existingIndex] = { ...buildings[existingIndex], level: check.nextLevel };
  return { ...state, resources, buildings };
}

export const constructBuilding = buildBuilding;

export function calculateBuildingResourceDelta(buildings: BuildingState[]): ResourceDelta {
  const delta: ResourceDelta = {};
  for (const building of buildings) {
    const definition = BUILDING_DEFINITIONS[building.id];
    if (!definition || building.level <= 0) continue;
    for (const [key, value] of Object.entries(definition.monthlyProduction)) {
      const resource = key as keyof NationalResources;
      delta[resource] = (delta[resource] ?? 0) + (value ?? 0) * building.level;
    }
    for (const [key, value] of Object.entries(definition.monthlyUpkeep)) {
      const resource = key as keyof NationalResources;
      delta[resource] = (delta[resource] ?? 0) - (value ?? 0) * building.level;
    }
  }
  return Object.fromEntries(Object.entries(delta).filter(([, value]) => value !== 0)) as ResourceDelta;
}
