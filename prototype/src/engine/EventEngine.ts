import rawEvents from "../../../data/events.json";
import {
  FACTION_IDS,
  PROVINCE_IDS,
  type FactionId,
  type FactionState,
  type GameState,
  type Memorial,
  type MemorialOption,
  type MemorialOptionEffect,
  type NationalResources,
  type ProvinceId,
  type ProvinceState,
} from "./GameState";

export type EventTier = "stable" | "tense" | "crisis";

/** Event choices expose faction readouts in addition to executable effects. */
export interface EventOption extends MemorialOption {
  /** Factions that gain satisfaction, wealth, influence, or protection. */
  benefits: FactionId[];
  /** Factions that lose satisfaction, wealth, influence, or face more risk. */
  costs: FactionId[];
}

/** JSON-friendly definition of a monthly event. */
export interface EventDefinition {
  id: string;
  name: string;
  category: string;
  tier: EventTier;
  baseProbability: number;
  conditions: string[];
  description: string;
  source: string;
  urgency: "low" | "normal" | "high";
  durationMonths: number;
  options: EventOption[];
}

type RawEvent = {
  id: string;
  name: string;
  category?: string;
  tier?: string;
  severity?: string;
  base_probability?: number;
  baseProbability?: number;
  conditions?: string[];
  description?: string;
  source?: string;
  urgency?: "low" | "normal" | "high";
  duration_months?: number;
  durationMonths?: number;
  options?: Array<{
    id: string;
    label: string;
    description?: string;
    effects?: unknown[];
    benefits?: unknown;
    benefits_factions?: unknown;
    costs?: unknown;
    costs_factions?: unknown;
  }>;
};

const resourceKeys: Array<keyof NationalResources> = [
  "treasury",
  "food",
  "weapons",
  "army",
  "authority",
  "morale",
];

type FactionDeltaKey = Exclude<keyof FactionState, "id" | "name">;
const factionKeys: FactionDeltaKey[] = [
  "satisfaction",
  "influence",
  "wealth",
  "organization",
  "resentment",
  "fear",
];

type ProvinceDeltaKey = Exclude<keyof ProvinceState, "id" | "name" | "population">;
const provinceKeys: ProvinceDeltaKey[] = [
  "food",
  "treasury",
  "security",
  "morale",
  "corruption",
  "localLoyalty",
  "rebellionRisk",
  "militaryPresence",
];

const asFactionId = (value: unknown): FactionId | undefined =>
  typeof value === "string" && FACTION_IDS.includes(value as FactionId)
    ? (value as FactionId)
    : undefined;

const asProvinceId = (value: unknown): ProvinceId | undefined =>
  typeof value === "string" && PROVINCE_IDS.includes(value as ProvinceId)
    ? (value as ProvinceId)
    : undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalize snake_case data while keeping the engine API camelCase. */
function normalizeEffect(value: unknown): MemorialOptionEffect | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  if (value.type === "resource_delta") {
    const resource = value.resource;
    if (!resourceKeys.includes(resource as keyof NationalResources) || typeof value.amount !== "number") {
      return undefined;
    }
    return { type: "resource_delta", resource: resource as keyof NationalResources, amount: value.amount };
  }

  if (value.type === "faction_delta") {
    const factionId = asFactionId(value.factionId ?? value.faction_id);
    if (!factionId) return undefined;
    const effect: Extract<MemorialOptionEffect, { type: "faction_delta" }> = { type: "faction_delta", factionId };
    for (const key of factionKeys) {
      if (typeof value[key] === "number") {
        effect[key] = value[key] as never;
      }
    }
    return effect;
  }

  if (value.type === "province_delta") {
    const effect: Extract<MemorialOptionEffect, { type: "province_delta" }> = {
      type: "province_delta",
      provinceId: asProvinceId(value.provinceId ?? value.province_id),
    };
    for (const key of provinceKeys) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const amount = value[key] ?? value[snakeKey];
      if (typeof amount === "number") effect[key] = amount as never;
    }
    return effect;
  }

  if (value.type === "state_modifier") {
    const duration = value.durationMonths ?? value.duration_months;
    if (typeof value.id !== "string" || typeof value.name !== "string" || typeof duration !== "number") {
      return undefined;
    }
    return {
      type: "state_modifier",
      id: value.id,
      name: value.name,
      durationMonths: Math.max(1, Math.round(duration)),
    };
  }

  if (value.type === "spawn_event" && typeof (value.eventId ?? value.event_id) === "string") {
    return { type: "spawn_event", eventId: (value.eventId ?? value.event_id) as string };
  }

  return undefined;
}

function normalizeOptions(raw: RawEvent): EventOption[] {
  const options = raw.options ?? [];
  return options.map((option) => {
    const effects = (option.effects ?? []).map(normalizeEffect).filter((effect): effect is MemorialOptionEffect => Boolean(effect));
    const effectFactions = effects.flatMap((effect) => {
      if (effect.type === "faction_delta") return [effect.factionId];
      if (effect.type === "province_delta") return [];
      return [];
    });
    const factionList = (value: unknown): FactionId[] => Array.isArray(value)
      ? value.map(asFactionId).filter((id): id is FactionId => Boolean(id))
      : [];
    const benefits = factionList(option.benefits ?? option.benefits_factions);
    const costs = factionList(option.costs ?? option.costs_factions);
    // Older event JSON did not carry readout metadata. Infer it from the
    // signed faction effects so old saves/data remain useful to the UI.
    for (const factionId of effectFactions) {
      const factionEffect = effects.find((effect) => effect.type === "faction_delta" && effect.factionId === factionId);
      if (factionEffect?.type === "faction_delta") {
        const score = [factionEffect.satisfaction, factionEffect.influence, factionEffect.wealth, factionEffect.organization]
          .filter((value): value is number => typeof value === "number")
          .reduce((sum, value) => sum + value, 0);
        if (score >= 0 && !benefits.includes(factionId)) benefits.push(factionId);
        if (score < 0 && !costs.includes(factionId)) costs.push(factionId);
      }
    }
    // Every option needs at least one legible upside/downside and one actual
    // state effect; neutral options get an authority nudge rather than being
    // silently displayed as flavour text.
    if (benefits.length === 0) benefits.push("gentry");
    if (costs.length === 0) costs.push(benefits[0] === "gentry" ? "peasants" : "gentry");
    if (effects.length === 0) effects.push({ type: "resource_delta", resource: "authority", amount: -1 });
    return {
      id: option.id,
      label: option.label,
      description: option.description ?? "执行此方略，局势将随之变化。",
      effects,
      benefits,
      costs,
    };
  });
}

const normalizedEvents: EventDefinition[] = (rawEvents.events as RawEvent[]).map((raw) => ({
  id: raw.id,
  name: raw.name,
  category: raw.category ?? "political",
  tier: raw.tier === "crisis" || raw.tier === "tense" ? raw.tier : raw.severity === "crisis" || raw.severity === "tense" ? raw.severity : (raw.urgency === "high" ? "crisis" : raw.urgency === "low" ? "stable" : "tense"),
  baseProbability: raw.baseProbability ?? raw.base_probability ?? 0.1,
  conditions: raw.conditions ?? [],
  description: raw.description ?? `${raw.name}的消息传入宫中，请陛下裁决。`,
  source: raw.source ?? "地方急报",
  urgency: raw.urgency ?? "normal",
  durationMonths: Math.max(1, raw.durationMonths ?? raw.duration_months ?? 1),
  options: normalizeOptions(raw),
}));

/** Event definitions loaded from data/events.json. */
export const EVENT_DEFINITIONS: EventDefinition[] = normalizedEvents;

const eventById = new Map(EVENT_DEFINITIONS.map((event) => [event.id, event]));

export function getEventDefinition(id: string): EventDefinition | undefined {
  return eventById.get(id);
}

/** The next unresolved event shown in the emperor's decision panel. */
export function getPendingEvent(state: Pick<GameState, "pendingMemorials">): Memorial | undefined {
  return state.pendingMemorials[0];
}

/**
 * A tiny deterministic random source. It makes replays and tests stable while
 * still giving players a changing sequence of events across months.
 */
export function eventRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

type MetricName = keyof NationalResources | "security" | "corruption" | "gentry_influence" | "landlord_influence" | "military" | "rebellion_risk" | "local_loyalty";

function metricValue(state: GameState, name: MetricName): number {
  if (name in state.resources) return state.resources[name as keyof NationalResources];
  if (name === "military") return state.resources.army / 100;
  const values = state.provinces.map((province) => {
    if (name === "security") return province.security;
    if (name === "corruption") return province.corruption;
    if (name === "gentry_influence") return province.gentryInfluence;
    if (name === "landlord_influence") return province.landlordInfluence;
    if (name === "rebellion_risk") return province.rebellionRisk;
    if (name === "local_loyalty") return province.localLoyalty;
    return 0;
  });
  if (values.length === 0) return 0;
  // Low-state indicators use the worst province; high influence/corruption
  // indicators use the most extreme province. A single failing province should
  // be enough to send an urgent memorial to the capital.
  if (["corruption", "gentry_influence", "landlord_influence", "rebellion_risk"].includes(name)) {
    return Math.max(...values);
  }
  return Math.min(...values);
}

function parseCondition(condition: string): { name: MetricName; operator: string; value: number } | undefined {
  const match = /^\s*([a-z_]+)\s*(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/i.exec(condition);
  if (!match) return undefined;
  const name = match[1] as MetricName;
  const operator = match[2];
  const value = Number(match[3]);
  return { name, operator, value };
}

function conditionMatches(state: GameState, condition: string): boolean {
  const parsed = parseCondition(condition);
  if (!parsed) return false;
  const actual = metricValue(state, parsed.name);
  switch (parsed.operator) {
    case "<": return actual < parsed.value;
    case "<=": return actual <= parsed.value;
    case ">": return actual > parsed.value;
    case ">=": return actual >= parsed.value;
    case "=": return actual === parsed.value;
    default: return false;
  }
}

function eligible(state: GameState, definition: EventDefinition): boolean {
  if (definition.id === "EV000" && state.history.some((entry) => entry.events.includes("EV000"))) return false;
  if (state.activeEvents.some((event) => event.id === definition.id)) return false;
  return true;
}

function eventWeight(state: GameState, definition: EventDefinition): number {
  const matched = definition.conditions.length === 0 || definition.conditions.every((condition) => conditionMatches(state, condition));
  // Conditions are probability modifiers, not hard gates. This allows an
  // otherwise calm court to still encounter a rare disaster.
  return Math.max(0.01, definition.baseProbability * (matched ? 3.2 : 0.42));
}

function pickProvince(state: GameState, definition: EventDefinition): ProvinceState | undefined {
  if (state.provinces.length === 0) return undefined;
  if (definition.id === "EV005" || definition.id === "EV006" || definition.id === "EV004") {
    return [...state.provinces].sort((left, right) => left.security - right.security || left.morale - right.morale)[0];
  }
  if (definition.id === "EV007" || definition.id === "EV008" || definition.id === "EV010") {
    return [...state.provinces].sort((left, right) => right.corruption - left.corruption || right.localLoyalty - left.localLoyalty)[0];
  }
  return state.provinces.find((province) => province.id === "he_dong") ?? state.provinces[0];
}

function createMemorial(definition: EventDefinition, state: GameState, sequence: number): Memorial {
  const province = pickProvince(state, definition);
  const provinceName = province ? ` · ${province.name}` : "";
  const options = definition.options.length >= 2
    ? definition.options
    : [
        {
          id: "accept",
          label: "立即处置",
          description: "拨出资源，将事态控制在萌芽阶段。",
          effects: [{ type: "resource_delta", resource: "treasury", amount: -500 }],
          benefits: ["military"],
          costs: ["landlords"],
        },
        {
          id: "defer",
          label: "暂缓处理",
          description: "保留储备，但风险会继续累积。",
          effects: [{ type: "resource_delta", resource: "authority", amount: -2 }],
          benefits: ["landlords"],
          costs: ["gentry"],
        },
      ] satisfies EventOption[];
  return {
    id: `${definition.id}-${sequence}`,
    eventId: definition.id,
    category: definition.category,
    title: `${definition.name}${provinceName}`,
    source: definition.source,
    description: province ? `${province.name}传来急报：${definition.description}` : definition.description,
    urgency: definition.urgency,
    provinceId: province?.id,
    options,
    createdAt: sequence,
  };
}

export interface MonthlyEventResult {
  memorials: Memorial[];
  activeEvents: GameState["activeEvents"];
  /** Pressure tier used for telemetry/UI; absent on an empty draw. */
  tier?: EventTier;
  /** Events that could not fit in the eight-item queue. */
  deferred?: number;
}

function pressureTier(state: GameState): EventTier {
  const crisis = state.crisis?.stage === "critical"
    || (state.crisis?.pressure ?? 0) >= 80
    || state.resources.food < 6_000
    || state.resources.treasury < 4_000
    || state.provinces.some((province) => province.security < 45 || province.morale < 35 || province.rebellionRisk > 50)
    || state.factions.some((faction) => faction.satisfaction < 28 || faction.resentment > 55);
  if (crisis) return "crisis";
  const tense = state.crisis?.stage === "warning"
    || (state.crisis?.pressure ?? 0) >= 45
    || state.resources.food < 18_000
    || state.resources.treasury < 12_000
    || state.provinces.some((province) => province.security < 60 || province.morale < 48 || province.rebellionRisk > 25)
    || state.factions.some((faction) => faction.satisfaction < 45 || faction.resentment > 25);
  return tense ? "tense" : "stable";
}

function drawCount(tier: EventTier, random: (seed: number) => number, seed: number): number {
  if (tier === "stable") return 1 + Math.floor(random(seed) * 2); // 1–2
  if (tier === "tense") return 2 + Math.floor(random(seed) * 3); // 2–4
  return 4 + Math.floor(random(seed) * 3); // 4–6
}

/**
 * Draw the month's court docket. The first month is a guaranteed tutorial
 * decision; thereafter the number of memorials scales with the current
 * pressure tier (stable 1–2, tense 2–4, crisis 4–6).
 */
export function drawMonthlyEvent(
  state: GameState,
  totalMonths = state.time.totalMonths,
  random: (seed: number) => number = eventRandom,
): MonthlyEventResult {
  const queueCapacity = 8;
  const measuredTier = pressureTier(state);
  const tier: EventTier = totalMonths <= 3 ? "stable" : measuredTier;
  if (state.pendingMemorials.length >= queueCapacity) return { memorials: [], activeEvents: [], tier, deferred: 1 };

  // The first month of a run is a guaranteed tutorial decision. Checking the
  // history as well means a loaded state that already contains the tutorial is
  // not offered a duplicate memorial.
  const firstMonth = totalMonths === 1 && !state.history.some((entry) => entry.events.includes("EV000"));
  // Every month has something for the court to deal with.  The pressure tier
  // below controls whether this is a light administrative docket or a flood
  // of urgent memorials; it is intentionally not gated behind a quarterly
  // cadence so the player never falls back into a dead "advance month" loop.

  const tierRank: Record<EventTier, number> = { stable: 0, tense: 1, crisis: 2 };
  // A calm month only surfaces low-intensity petitions. As pressure rises the
  // pool widens, allowing a tense month to contain routine matters and a
  // crisis month to pull from the full table.
  const candidates = EVENT_DEFINITIONS.filter((definition) =>
    definition.id !== "EV000" && eligible(state, definition) && tierRank[definition.tier] <= tierRank[tier],
  );
  if (candidates.length === 0) return { memorials: [], activeEvents: [], tier };

  // EV000 is the onboarding decision. It is intentionally data-driven but
  // guaranteed once, so a fresh game never feels like an empty month counter.
  const tutorial = eventById.get("EV000");
  if (firstMonth && tutorial) {
    const memorial = createMemorial(tutorial, state, totalMonths);
    return {
      memorials: [memorial],
      activeEvents: [{ id: tutorial.id, name: tutorial.name, category: tutorial.category, urgency: tutorial.urgency, durationMonths: tutorial.durationMonths }],
      tier: "stable",
    };
  }

  const requestedCount = drawCount(tier, random, totalMonths * 17 + state.history.length);
  const availableSlots = Math.max(0, queueCapacity - state.pendingMemorials.length);
  const drawTotal = Math.min(requestedCount, availableSlots, candidates.length);
  const selectedIds = new Set<string>();
  const selected: EventDefinition[] = [];
  for (let drawIndex = 0; drawIndex < drawTotal; drawIndex += 1) {
    const pool = candidates.filter((candidate) => !selectedIds.has(candidate.id));
    const weights = pool.map((candidate) => eventWeight(state, candidate));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const roll = random(totalMonths * 17 + state.history.length + drawIndex * 97) * totalWeight;
    let cursor = 0;
    let chosen = pool[pool.length - 1];
    for (let index = 0; index < pool.length; index += 1) {
      cursor += weights[index];
      if (roll <= cursor) { chosen = pool[index]; break; }
    }
    if (!chosen) break;
    selected.push(chosen);
    selectedIds.add(chosen.id);
  }

  const memorials = selected.map((definition, index) => createMemorial(definition, state, totalMonths * 10 + index));
  return {
    memorials,
    activeEvents: selected.map((definition) => ({ id: definition.id, name: definition.name, category: definition.category, urgency: definition.urgency, durationMonths: definition.durationMonths })),
    tier,
    deferred: Math.max(0, requestedCount - drawTotal),
  };
}

function boundedResource(resource: keyof NationalResources, value: number): number {
  if (resource === "authority" || resource === "morale") return Math.max(0, Math.min(100, value));
  return Math.max(0, value);
}

function applyResourceEffects(state: GameState, effects: MemorialOptionEffect[]): { resources: NationalResources; changes: Partial<Record<keyof NationalResources, number>> } {
  const resources = { ...state.resources };
  const changes: Partial<Record<keyof NationalResources, number>> = {};
  for (const effect of effects) {
    if (effect.type !== "resource_delta") continue;
    const before = resources[effect.resource];
    const after = boundedResource(effect.resource, before + effect.amount);
    resources[effect.resource] = after;
    if (after !== before) changes[effect.resource] = (changes[effect.resource] ?? 0) + after - before;
  }
  return { resources, changes };
}

function mergeResourceChanges(
  left: Partial<Record<keyof NationalResources, number>>,
  right: Partial<Record<keyof NationalResources, number>>,
): Partial<Record<keyof NationalResources, number>> {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const resource = key as keyof NationalResources;
    result[resource] = (result[resource] ?? 0) + (value ?? 0);
  }
  return result;
}

function applyFactionEffects(state: GameState, effects: MemorialOptionEffect[]): { factions: FactionState[]; changes: Partial<Record<FactionId, number>> } {
  const factions = state.factions.map((faction) => ({ ...faction }));
  const changes: Partial<Record<FactionId, number>> = {};
  for (const effect of effects) {
    if (effect.type !== "faction_delta") continue;
    const index = factions.findIndex((faction) => faction.id === effect.factionId);
    if (index === -1) continue;
    const faction = factions[index];
    const beforeSatisfaction = faction.satisfaction;
    for (const key of factionKeys) {
      if (typeof effect[key] !== "number") continue;
      const before = faction[key] as number;
      const after = Math.max(0, Math.min(100, before + (effect[key] as number)));
      (faction[key] as number) = after;
    }
    if (faction.satisfaction !== beforeSatisfaction) {
      changes[effect.factionId] = (changes[effect.factionId] ?? 0) + faction.satisfaction - beforeSatisfaction;
    }
  }
  return { factions, changes };
}

function applyProvinceEffects(state: GameState, effects: MemorialOptionEffect[]): ProvinceState[] {
  const provinces = state.provinces.map((province) => ({ ...province }));
  for (const effect of effects) {
    if (effect.type !== "province_delta") continue;
    const index = provinces.findIndex((province) => province.id === (effect.provinceId ?? "central"));
    if (index === -1) continue;
    const province = provinces[index];
    for (const key of provinceKeys) {
      if (typeof effect[key] !== "number") continue;
      const before = province[key] as number;
      const upperBound = key === "security" || key === "morale" || key === "corruption" || key === "localLoyalty" || key === "rebellionRisk" ? 100 : Number.POSITIVE_INFINITY;
      (province[key] as number) = Math.max(0, Math.min(upperBound, before + (effect[key] as number)));
    }
  }
  return provinces;
}

/** Resolve one player choice from the pending memorial queue. */
export function resolveMemorial(state: GameState, memorialId: string, optionId: string): GameState {
  const memorial = state.pendingMemorials.find((item) => item.id === memorialId);
  if (!memorial) return state;
  const option = memorial.options?.find((item) => item.id === optionId);
  if (!option) return state;

  const resourceResult = applyResourceEffects(state, option.effects);
  const factionResult = applyFactionEffects(state, option.effects);
  const provinces = applyProvinceEffects(state, option.effects);
  const activeModifiers = [...state.activeModifiers];
  const pendingMemorials = state.pendingMemorials.filter((item) => item.id !== memorialId);
  const activeEvents = state.activeEvents.filter((event) => event.id !== memorial.eventId);
  const spawned: Memorial[] = [];

  for (const effect of option.effects) {
    if (effect.type === "state_modifier") {
      activeModifiers.push({ id: effect.id, name: effect.name, durationMonths: effect.durationMonths });
    } else if (effect.type === "spawn_event") {
      const definition = getEventDefinition(effect.eventId);
      if (definition && !activeEvents.some((event) => event.id === definition.id)) {
        spawned.push(createMemorial(definition, { ...state, provinces }, state.time.totalMonths));
        activeEvents.push({ id: definition.id, name: definition.name, category: definition.category, urgency: definition.urgency, durationMonths: definition.durationMonths });
      }
    }
  }
  pendingMemorials.push(...spawned);
  // Follow-up chains are allowed to build pressure, but the emperor's desk
  // never grows beyond eight visible dossiers. Dropped chain events remain
  // deferred (their active marker is removed so a later draw can retry).
  const deferredCount = Math.max(0, pendingMemorials.length - 8);
  const queuedMemorials = pendingMemorials.slice(0, 8);
  const queuedEventIds = new Set(queuedMemorials.map((item) => item.eventId).filter((id): id is string => Boolean(id)));
  const spawnedIds = new Set(spawned.map((item) => item.eventId).filter((id): id is string => Boolean(id)));
  const queuedActiveEvents = activeEvents.filter((event) => !spawnedIds.has(event.id) || queuedEventIds.has(event.id));
  const crisis = deferredCount > 0 && state.crisis
    ? {
        ...state.crisis,
        pressure: Math.min(100, state.crisis.pressure + deferredCount * 8),
        stage: state.crisis.pressure + deferredCount * 8 >= 70 ? "critical" as const : state.crisis.stage,
      }
    : state.crisis;

  const history = [...state.history];
  const latest = history[history.length - 1];
  if (latest) {
    const eventId = memorial.eventId ?? memorial.id;
    // Event creation is already recorded by the monthly loop. Keep the event
    // counter at one while recording the player's actual choice in actions;
    // append only genuinely new chain events spawned by that choice.
    const knownEvents = latest.events.some((entry) => entry === eventId || entry.startsWith(`${eventId}：`));
    const spawnedEventIds = spawned.map((item) => item.eventId ?? item.id);
    history[history.length - 1] = {
      ...latest,
      actions: [...latest.actions, `${memorial.title}：${option.label}`],
      resourceChanges: mergeResourceChanges(latest.resourceChanges, resourceResult.changes),
      factionChanges: {
        ...latest.factionChanges,
        ...Object.fromEntries(Object.entries(factionResult.changes).map(([id, value]) => [id, (latest.factionChanges[id as FactionId] ?? 0) + (value ?? 0)])),
      },
      events: [...(knownEvents ? latest.events : [...latest.events, eventId]), ...spawnedEventIds],
      memorials: [
        ...latest.memorials,
        ...(latest.memorials.includes(memorial.id) ? [] : [memorial.id]),
        ...spawned.map((item) => item.id).filter((id) => !latest.memorials.includes(id)),
      ],
    };
  }

  return {
    ...state,
    resources: resourceResult.resources,
    factions: factionResult.factions,
    provinces,
    activeModifiers,
    pendingMemorials: queuedMemorials,
    activeEvents: queuedActiveEvents,
    crisis,
    history,
  };
}

/** Friendly aliases used by UI callers. */
export const chooseMemorial = resolveMemorial;

/**
 * Resolve by either a memorial instance id (`EV001-3`) or its event id
 * (`EV001`). Accepting both forms keeps lightweight callers from having to
 * know how the monthly loop sequences repeated events.
 */
export function resolveEvent(state: GameState, memorialOrEventId: string, optionId: string): GameState {
  const memorial = state.pendingMemorials.find(
    (item) => item.id === memorialOrEventId || item.eventId === memorialOrEventId,
  );
  return memorial ? resolveMemorial(state, memorial.id, optionId) : state;
}
