import {
  GAME_MONTHS,
  MONTHS_PER_YEAR,
  type CrisisState,
  type CrisisType,
  type FactionId,
  type FactionState,
  type GameState,
  type HistoryEntry,
  type NationalResources,
  type ProvinceState,
} from "./GameState";
import {
  calculateBuildingResourceDelta,
  type ResourceDelta,
} from "./Buildings";
import { drawMonthlyEvent, type MonthlyEventResult } from "./EventEngine";

export function formatReignDate(state: Pick<GameState, "time" | "emperor">): string {
  const yearLabel = state.time.year === 1 ? "元" : String(state.time.year);
  const monthLabels = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  const monthLabel = monthLabels[state.time.month - 1] ?? String(state.time.month);
  return `${state.emperor.reignTitle}${yearLabel}年·${monthLabel}月`;
}
const boundedResources: Array<keyof NationalResources> = ["treasury", "food", "weapons", "army"];
const boundedPercentages: Array<keyof NationalResources> = ["authority", "morale"];
const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

function advanceDurations<T extends { durationMonths: number }>(items: T[]): T[] {
  return items
    .map((item) => ({ ...item, durationMonths: Math.max(0, item.durationMonths - 1) }))
    .filter((item) => item.durationMonths > 0);
}

function applyResourceDelta(
  resources: NationalResources,
  requested: ResourceDelta,
): { resources: NationalResources; actual: ResourceDelta; shortages: string[] } {
  const nextResources = { ...resources };
  const actual: ResourceDelta = {};
  const shortages: string[] = [];

  for (const [key, requestedValue] of Object.entries(requested)) {
    const resourceKey = key as keyof NationalResources;
    const value = requestedValue ?? 0;
    const before = resources[resourceKey];
    const unbounded = before + value;
    const after = boundedResources.includes(resourceKey)
      ? Math.max(0, unbounded)
      : boundedPercentages.includes(resourceKey)
        ? clamp(unbounded)
        : unbounded;
    nextResources[resourceKey] = after;
    if (after !== before) actual[resourceKey] = after - before;
    if (value < 0 && unbounded < 0) shortages.push(resourceKey);
  }
  return { resources: nextResources, actual, shortages };
}

function average(provinces: ProvinceState[], key: keyof ProvinceState): number {
  if (provinces.length === 0) return 0;
  return provinces.reduce((sum, province) => sum + Number(province[key] ?? 0), 0) / provinces.length;
}

function productionFactor(province: ProvinceState): number {
  return clamp(
    0.35 + province.security / 180 + province.morale / 250
      + province.localLoyalty / 300 - province.corruption / 220,
    0.2,
    1.15,
  );
}

/** Central collection efficiency derived from authority, loyalty and corruption. */
export function centralCollectionEfficiency(state: Pick<GameState, "resources" | "provinces">): number {
  const value = 0.28
    + state.resources.authority / 220
    + average(state.provinces, "localLoyalty") / 320
    - average(state.provinces, "corruption") / 260;
  return clamp(value, 0.2, 0.9);
}

export interface ProvinceProduction {
  provinceId: ProvinceState["id"];
  food: number;
  treasury: number;
}

/** Calculate gross local production before central taxes are collected. */
export function calculateProvinceProduction(state: Pick<GameState, "provinces">): ProvinceProduction[] {
  return state.provinces.map((province) => {
    const factor = productionFactor(province);
    return {
      provinceId: province.id,
      // Population and the province's historical food/treasury ratings are in
      // compact prototype units, so these yields remain readable stockpiles.
      food: Math.max(0, Math.round(province.population * 7 * factor)),
      treasury: Math.max(0, Math.round(province.treasury * 10 * factor)),
    };
  });
}

function modifierRevenue(state: GameState): number {
  return state.activeModifiers.reduce((total, modifier) => {
    if (modifier.id === "trade_boom") return total + 400;
    if (modifier.id === "trade_route" || modifier.id === "east_trade") return total + 250;
    return total;
  }, 0);
}

function factionById(factions: FactionState[], id: FactionId): FactionState | undefined {
  return factions.find((faction) => faction.id === id);
}

function updateFactions(factions: FactionState[], shortages: string[]): {
  factions: FactionState[];
  changes: Partial<Record<FactionId, number>>;
} {
  const changes: Partial<Record<FactionId, number>> = {};
  const next = factions.map((faction) => {
    const before = faction.satisfaction;
    const satisfaction = clamp(before + (before < 50 ? 0.35 : -0.2));
    let resentment = faction.resentment;
    if (satisfaction < 40) resentment += satisfaction < 25 ? 2 : 1;
    else if (satisfaction > 60) resentment = Math.max(0, resentment - 0.5);
    return { ...faction, satisfaction, resentment };
  });

  const apply = (id: FactionId, satisfaction: number, resentment: number) => {
    const faction = factionById(next, id);
    if (!faction) return;
    const before = faction.satisfaction;
    faction.satisfaction = clamp(faction.satisfaction + satisfaction);
    faction.resentment = Math.max(0, faction.resentment + resentment);
    changes[id] = (changes[id] ?? 0) + faction.satisfaction - before;
  };
  if (shortages.includes("food")) apply("peasants", -4, 3);
  if (shortages.includes("treasury")) apply("military", -4, 3);
  return { factions: next, changes };
}

function updateProvinces(provinces: ProvinceState[], shortages: string[]): ProvinceState[] {
  return provinces.map((province) => {
    const next = { ...province };
    // Corruption naturally grows very slowly; high loyalty and security keep
    // the leak contained, while a shortage makes every local problem sharper.
    next.corruption = clamp(next.corruption + (next.corruption > 55 ? 0.4 : 0.1));
    if (shortages.includes("food")) {
      next.morale = clamp(next.morale - 2);
      next.security = clamp(next.security - 1);
      next.rebellionRisk = clamp(next.rebellionRisk + 4);
    }
    if (shortages.includes("treasury")) next.corruption = clamp(next.corruption + 2);
    return next;
  });
}

export interface MonthlyEconomyResult {
  resources: NationalResources;
  resourceChanges: ResourceDelta;
  provinces: ProvinceState[];
  factions: FactionState[];
  shortages: string[];
  factionChanges: Partial<Record<FactionId, number>>;
  provincialProduction: ProvinceProduction[];
  collectionEfficiency: number;
}

/**
 * Settle local production, central collection, building yields and national
 * upkeep. Missing food or silver is deliberately converted into political and
 * provincial damage rather than an immediate game over.
 */
export function settleMonthlyEconomyDetailed(state: GameState): MonthlyEconomyResult {
  const provincialProduction = calculateProvinceProduction(state);
  const collectionEfficiency = centralCollectionEfficiency(state);
  const grossFood = provincialProduction.reduce((sum, item) => sum + item.food, 0);
  const grossTreasury = provincialProduction.reduce((sum, item) => sum + item.treasury, 0);
  const requested: ResourceDelta = {
    food: Math.round(grossFood * collectionEfficiency),
    treasury: Math.round(grossTreasury * collectionEfficiency) + modifierRevenue(state),
  };

  const buildingDelta = calculateBuildingResourceDelta(state.buildings);
  for (const [key, value] of Object.entries(buildingDelta)) {
    const resource = key as keyof NationalResources;
    requested[resource] = (requested[resource] ?? 0) + (value ?? 0);
  }

  // Army upkeep is proportional to the force, with a separate payroll and an
  // administration bill. This keeps a large army powerful but never free.
  requested.food = (requested.food ?? 0) - Math.ceil(state.resources.army * 0.05);
  requested.treasury = (requested.treasury ?? 0)
    - Math.ceil(state.resources.army * 0.02)
    - (300 + state.provinces.length * 90 + Math.round(average(state.provinces, "corruption") * 2));
  const settled = applyResourceDelta(state.resources, requested);
  const provinceState = updateProvinces(state.provinces, settled.shortages);
  const factionState = updateFactions(state.factions, settled.shortages);
  return {
    resources: settled.resources,
    resourceChanges: settled.actual,
    provinces: provinceState,
    factions: factionState.factions,
    shortages: settled.shortages,
    factionChanges: factionState.changes,
    provincialProduction,
    collectionEfficiency,
  };
}

/**
 * Backwards-compatible public shape from the original prototype. New callers
 * that need province/faction diagnostics can use settleMonthlyEconomyDetailed.
 */
export function settleMonthlyEconomy(state: GameState): {
  resources: NationalResources;
  resourceChanges: ResourceDelta;
} {
  const detailed = settleMonthlyEconomyDetailed(state);
  return { resources: detailed.resources, resourceChanges: detailed.resourceChanges };
}

export interface CrisisPressure {
  peasant_revolt: number;
  military_coup: number;
  gentry_coup: number;
  landlord_secession: number;
  state_collapse: number;
}

/** Calculate pressure for each distinct route to losing the throne. */
export function calculateCrisisPressure(state: GameState): CrisisPressure {
  const peasants = factionById(state.factions, "peasants");
  const military = factionById(state.factions, "military");
  const gentry = factionById(state.factions, "gentry");
  const landlords = factionById(state.factions, "landlords");
  const security = average(state.provinces, "security");
  const rebellionRisk = average(state.provinces, "rebellionRisk");
  const peasantPressure = clamp(
    Math.max(0, 44 - state.resources.morale) * 1.7
      + rebellionRisk * 0.8 * clamp((60 - state.resources.morale) / 25, 0, 1)
      // A zero granary is dangerous only when people are already unhappy;
      // a stable, well-governed realm can absorb a temporary stockpile dip.
      + Math.max(0, (5_000 - state.resources.food) / 100)
        * clamp((65 - state.resources.morale) / 25, 0, 1)
      + Math.max(0, 48 - security) * 0.8
      + (peasants?.resentment ?? 0) * 0.45,
  );
  const militaryPressure = clamp(
    Math.max(0, 48 - (military?.satisfaction ?? 50)) * 1.8
      + (military?.resentment ?? 0) * 0.55
      + Math.max(0, (2_000 - state.resources.treasury) / 100)
      + Math.max(0, (1_000 - state.resources.weapons) / 100),
  );
  const gentryPressure = clamp(
    Math.max(0, 45 - (gentry?.satisfaction ?? 50)) * 1.5
      + (gentry?.resentment ?? 0) * 0.5
      + Math.max(0, 28 - state.resources.authority) * 0.8,
  );
  const landlordPressure = clamp(
    Math.max(0, 45 - (landlords?.satisfaction ?? 50)) * 1.5
      + (landlords?.resentment ?? 0) * 0.5
      + Math.max(0, 30 - state.resources.authority) * 0.6,
  );
  const factionMax = Math.max(peasantPressure, militaryPressure, gentryPressure, landlordPressure);
  const stateCollapse = clamp(
    Math.max(0, 38 - state.resources.authority) * 1.3
      + Math.max(0, 35 - state.resources.morale) * 1.1
      + factionMax * 0.65
      + (state.resources.food === 0 && state.resources.morale < 55 ? 18 : 0)
      + (state.resources.treasury === 0 && state.resources.authority < 55 ? 18 : 0),
  );
  return {
    peasant_revolt: peasantPressure,
    military_coup: militaryPressure,
    gentry_coup: gentryPressure,
    landlord_secession: landlordPressure,
    state_collapse: stateCollapse,
  };
}

function crisisTypeFor(pressure: CrisisPressure): CrisisType {
  if (pressure.state_collapse >= 80) return "state_collapse";
  return (Object.entries(pressure) as Array<[CrisisType, number]>)
    .filter(([type]) => type !== "state_collapse")
    .sort((left, right) => right[1] - left[1])[0][0];
}

function crisisTriggerFaction(type: CrisisType): FactionId | undefined {
  if (type === "peasant_revolt") return "peasants";
  if (type === "military_coup") return "military";
  if (type === "gentry_coup") return "gentry";
  if (type === "landlord_secession") return "landlords";
  return undefined;
}

/** Update the persistent crisis gauge. No lethal check is made for months 1–3. */
export function updateCrisis(state: GameState, totalMonths: number): CrisisState | null {
  if (totalMonths < 4) return state.crisis;
  const pressure = calculateCrisisPressure(state);
  const dominantType = crisisTypeFor(pressure);
  const dominantScore = pressure[dominantType];
  if (!state.crisis && dominantScore < 20) return null;

  if (!state.crisis) {
    const initial = clamp(dominantScore * 0.65, 5, 50);
    const foodShortageMonths = state.resources.food <= 0 ? 1 : 0;
    const treasuryArrearsMonths = state.resources.treasury <= 0 ? 1 : 0;
    const unrestMonths = state.provinces.some((province) => province.morale < 40 || province.security < 45 || province.rebellionRisk > 50) ? 1 : 0;
    return {
      type: dominantType,
      pressure: initial,
      stage: initial >= 70 ? "critical" : "warning",
      startedAt: totalMonths,
      monthsActive: 1,
      provinceId: state.provinces[0]?.id,
      foodShortageMonths,
      treasuryArrearsMonths,
      unrestMonths,
      lastIncident: dominantType,
    };
  }

  const currentScore = pressure[state.crisis.type];
  // Pressure rises quickly when a route is neglected, and slowly cools after
  // the player repairs the underlying state.
  const monthlyStress = currentScore >= 20 ? (currentScore - 16) * 0.7 : -2;
  const nextPressure = clamp(state.crisis.pressure + monthlyStress);
  if (nextPressure <= 0) return null;
  const foodShortageMonths = state.resources.food <= 0 ? state.crisis.foodShortageMonths + 1 : 0;
  const treasuryArrearsMonths = state.resources.treasury <= 0 ? state.crisis.treasuryArrearsMonths + 1 : 0;
  const unrestMonths = state.provinces.some((province) => province.morale < 40 || province.security < 45 || province.rebellionRisk > 50)
    ? state.crisis.unrestMonths + 1
    : 0;
  return {
    ...state.crisis,
    pressure: nextPressure,
    stage: nextPressure >= 70 ? "critical" : "warning",
    monthsActive: state.crisis.monthsActive + 1,
    foodShortageMonths,
    treasuryArrearsMonths,
    unrestMonths,
    lastIncident: dominantType,
  };
}

function createMonthHistory(
  state: GameState,
  economy: MonthlyEconomyResult,
  crisis: CrisisState | null,
): HistoryEntry {
  const actions = ["州产出与中央征收已结算", "军粮、军饷与行政成本已结算"];
  if (Object.keys(economy.resourceChanges).length > 0) actions.push("建筑产出与维护已结算");
  return {
    year: state.time.year,
    month: state.time.month,
    totalMonths: state.time.totalMonths,
    actions,
    resourceChanges: economy.resourceChanges,
    factionChanges: economy.factionChanges,
    events: [],
    memorials: [],
    crisis: crisis?.type,
    pressure: crisis?.pressure,
    shortages: economy.shortages,
  };
}

function appendMonthlyEvents(state: GameState, result: MonthlyEventResult): GameState {
  const deferred = result.deferred ?? 0;
  if (result.memorials.length === 0 && deferred === 0) return state;
  const latest = state.history[state.history.length - 1];
  const history = [...state.history];
  if (latest) {
    history[history.length - 1] = {
      ...latest,
      events: [...latest.events, ...result.memorials.map((memorial) => memorial.eventId ?? memorial.id)],
      memorials: [...latest.memorials, ...result.memorials.map((memorial) => memorial.id)],
    };
  }
  const crisis = deferred > 0 && state.crisis
    ? {
        ...state.crisis,
        pressure: clamp(state.crisis.pressure + deferred * 3),
        stage: state.crisis.pressure + deferred * 3 >= 70 ? "critical" as const : state.crisis.stage,
        lastIncident: "急报积压",
      }
    : state.crisis;
  return {
    ...state,
    activeEvents: [...state.activeEvents, ...result.activeEvents],
    pendingMemorials: [...state.pendingMemorials, ...result.memorials],
    crisis,
    history,
  };
}

/** Advance one month. Optional random seed function keeps deterministic tests/replays possible. */
export function advanceMonth(state: GameState, random?: (seed: number) => number): GameState {
  if (state.ending) return state;
  const totalMonths = state.time.totalMonths + 1;
  const nextTime = {
    totalMonths,
    year: Math.floor(totalMonths / MONTHS_PER_YEAR) + 1,
    month: (totalMonths % MONTHS_PER_YEAR) + 1,
  };
  const economy = settleMonthlyEconomyDetailed(state);
  const provisional: GameState = {
    ...state,
    time: nextTime,
    resources: economy.resources,
    provinces: economy.provinces,
    factions: economy.factions,
    emperor: {
      ...state.emperor,
      age: state.emperor.age + (nextTime.month === 1 ? 1 : 0),
    },
    activeModifiers: advanceDurations(state.activeModifiers),
    activeEvents: advanceDurations(state.activeEvents),
    crisis: null,
    history: [],
    ending: null,
  };
  const crisis = updateCrisis({ ...provisional, crisis: state.crisis }, totalMonths);
  let nextState: GameState = {
    ...provisional,
    crisis,
    history: [
      ...state.history,
      createMonthHistory({ ...provisional, time: nextTime }, economy, crisis),
    ],
  };
  nextState = appendMonthlyEvents(nextState, drawMonthlyEvent(nextState, totalMonths, random));

  if (crisis && crisis.pressure >= 100 && totalMonths >= 4) {
    const triggerFactionId = crisisTriggerFaction(crisis.type);
    nextState.ending = {
      reason: crisis.type,
      totalMonths,
      crisis,
      triggerFactionId,
      cause: crisis.type === "state_collapse" ? "多项资源与治理防线同时崩溃" : `${triggerFactionId ?? "多方势力"}的压力突破临界点`,
      keyLogs: nextState.history.slice(-4).flatMap((entry) => entry.actions).slice(-5),
    };
  } else if (totalMonths >= GAME_MONTHS) {
    nextState.ending = { reason: "normal_retirement", totalMonths };
  }
  return nextState;
}
