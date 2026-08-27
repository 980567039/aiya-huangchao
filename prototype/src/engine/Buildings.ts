import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingState,
  type GameState,
  type NationalResources,
  type ProvinceId,
} from "./GameState";

/** A sparse resource change. Positive values are production, negative values are costs. */
export type ResourceDelta = Partial<Record<keyof NationalResources, number>>;

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  icon: string;
  /** A stable tone name for the UI (gold, red, or green). */
  tone: "gold" | "red" | "green";
  maxLevel: number;
  /** Cost to build level one. Each subsequent level costs base cost × level. */
  constructionCost: ResourceDelta;
  /** Resources added each month per level. */
  monthlyProduction: ResourceDelta;
  /** Resources consumed each month per level. */
  monthlyUpkeep: ResourceDelta;
}

/**
 * Main-city buildings available during the early development phase.
 *
 * The production numbers are deliberately small relative to the opening stockpile:
 * a player can experiment with construction in the first few years and still has to
 * plan a reserve for the later events/upkeep systems.
 */
export const BUILDING_DEFINITIONS: Record<BuildingId, BuildingDefinition> = {
  civilian: {
    id: "civilian",
    name: "民营",
    description: "兴办市集与工坊，持续增加国库并稳固皇权。",
    icon: "民",
    tone: "gold",
    maxLevel: 5,
    constructionCost: { treasury: 4_500 },
    monthlyProduction: { treasury: 1_250, authority: 1 },
    monthlyUpkeep: {},
  },
  barracks: {
    id: "barracks",
    name: "兵营",
    description: "训练新军、锻造兵器；军粮与军饷会随规模增加。",
    icon: "武",
    tone: "red",
    maxLevel: 5,
    constructionCost: { treasury: 6_000, weapons: 300 },
    monthlyProduction: { army: 180, weapons: 90, morale: 1 },
    monthlyUpkeep: { treasury: 220, food: 500 },
  },
  kitchen: {
    id: "kitchen",
    name: "伙房",
    description: "整备军民粮秣，稳定地产出粮食并提振民心。",
    icon: "粮",
    tone: "green",
    maxLevel: 5,
    constructionCost: { treasury: 3_500 },
    monthlyProduction: { food: 1_800, morale: 1 },
    monthlyUpkeep: { treasury: 120 },
  },
};

export type BuildFailureReason =
  | "game_ended"
  | "unknown_building"
  | "province_not_found"
  | "max_level"
  | "insufficient_resources";

export interface BuildCheck {
  ok: boolean;
  reason?: BuildFailureReason;
  /** Cost for the next level, useful for disabling/rendering a build button. */
  cost: ResourceDelta;
  nextLevel: number;
  definition?: BuildingDefinition;
}

function scaleDelta(delta: ResourceDelta, multiplier: number): ResourceDelta {
  return Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, (value ?? 0) * multiplier]),
  ) as ResourceDelta;
}

function hasResources(resources: NationalResources, cost: ResourceDelta): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as keyof NationalResources] >= (value ?? 0));
}

export function getBuildingDefinition(id: BuildingId | string): BuildingDefinition | undefined {
  return BUILDING_IDS.includes(id as BuildingId)
    ? BUILDING_DEFINITIONS[id as BuildingId]
    : undefined;
}

/** Return the cost and eligibility for constructing or upgrading a building. */
export function canBuild(
  state: Pick<GameState, "resources" | "buildings" | "provinces" | "ending">,
  id: BuildingId,
  provinceId: ProvinceId = "central",
): BuildCheck {
  const definition = getBuildingDefinition(id);
  if (!definition) {
    return { ok: false, reason: "unknown_building", cost: {}, nextLevel: 1 };
  }
  const existing = state.buildings.find(
    (building) => building.id === id && building.provinceId === provinceId,
  );
  const nextLevel = (existing?.level ?? 0) + 1;
  const cost = scaleDelta(definition.constructionCost, nextLevel);

  if (state.ending) {
    return { ok: false, reason: "game_ended", cost, nextLevel, definition };
  }
  if (!state.provinces.some((province) => province.id === provinceId)) {
    return { ok: false, reason: "province_not_found", cost, nextLevel, definition };
  }
  if (nextLevel > definition.maxLevel) {
    return { ok: false, reason: "max_level", cost, nextLevel, definition };
  }
  if (!hasResources(state.resources, cost)) {
    return { ok: false, reason: "insufficient_resources", cost, nextLevel, definition };
  }
  return { ok: true, cost, nextLevel, definition };
}

/**
 * Construct a new building or upgrade an existing one.
 *
 * Invalid requests are intentionally no-ops instead of throwing: this makes the
 * action safe to call directly from a UI button and preserves immutable state.
 */
export function buildBuilding(
  state: GameState,
  id: BuildingId,
  provinceId: ProvinceId = "central",
): GameState {
  const check = canBuild(state, id, provinceId);
  if (!check.ok || !check.definition) {
    return state;
  }

  const resources = { ...state.resources };
  for (const [key, value] of Object.entries(check.cost)) {
    const resourceKey = key as keyof NationalResources;
    resources[resourceKey] -= value ?? 0;
  }

  const existingIndex = state.buildings.findIndex(
    (building) => building.id === id && building.provinceId === provinceId,
  );
  const buildings = [...state.buildings];
  if (existingIndex === -1) {
    buildings.push({ id, provinceId, level: check.nextLevel });
  } else {
    buildings[existingIndex] = { ...buildings[existingIndex], level: check.nextLevel };
  }

  return { ...state, resources, buildings };
}

/** Alias for callers that prefer the verb used by the design docs. */
export const constructBuilding = buildBuilding;

/** Sum all building production and upkeep for one monthly settlement. */
export function calculateBuildingResourceDelta(
  buildings: BuildingState[],
): ResourceDelta {
  const delta: ResourceDelta = {};
  for (const building of buildings) {
    const definition = BUILDING_DEFINITIONS[building.id];
    if (!definition || building.level <= 0) {
      continue;
    }
    for (const [key, value] of Object.entries(definition.monthlyProduction)) {
      const resourceKey = key as keyof NationalResources;
      delta[resourceKey] = (delta[resourceKey] ?? 0) + (value ?? 0) * building.level;
    }
    for (const [key, value] of Object.entries(definition.monthlyUpkeep)) {
      const resourceKey = key as keyof NationalResources;
      delta[resourceKey] = (delta[resourceKey] ?? 0) - (value ?? 0) * building.level;
    }
  }
  return Object.fromEntries(
    Object.entries(delta).filter(([, value]) => value !== 0),
  ) as ResourceDelta;
}
