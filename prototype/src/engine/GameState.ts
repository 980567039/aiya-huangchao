export const MONTHS_PER_YEAR = 12;
export const GAME_MONTHS = 360;
export const STARTING_AGE = 20;
export const REIGN_TITLE = "景和";

export const PROVINCE_IDS = [
  "north_shuo",
  "he_dong",
  "central",
  "jiangnan",
  "lingnan",
] as const;

export const FACTION_IDS = ["gentry", "military", "peasants", "landlords"] as const;
/** Buildings available in the prototype's main city. */
export const BUILDING_IDS = ["civilian", "barracks", "kitchen"] as const;

export type ProvinceId = (typeof PROVINCE_IDS)[number];
export type FactionId = (typeof FACTION_IDS)[number];
export type BuildingId = (typeof BUILDING_IDS)[number];

export interface GameTime {
  /** Number of months elapsed since the start of the reign. Initial value is 0. */
  totalMonths: number;
  year: number;
  month: number;
}

export interface EmperorState {
  age: number;
  reignTitle: string;
}

export interface NationalResources {
  treasury: number;
  food: number;
  weapons: number;
  army: number;
  authority: number;
  morale: number;
}

/** A constructed building and its current upgrade level. */
export interface BuildingState {
  id: BuildingId;
  /** Buildings default to the central province (the capital/main city). */
  provinceId: ProvinceId;
  level: number;
}

export interface ProvinceState {
  id: ProvinceId;
  name: string;
  population: number;
  food: number;
  treasury: number;
  security: number;
  morale: number;
  corruption: number;
  localLoyalty: number;
  rebellionRisk: number;
  gentryInfluence: number;
  landlordInfluence: number;
  militaryPresence: number;
}

export interface FactionState {
  id: FactionId;
  name: string;
  satisfaction: number;
  influence: number;
  wealth: number;
  organization: number;
  resentment: number;
  fear: number;
}

export interface ActiveModifier {
  id: string;
  name: string;
  durationMonths: number;
}

export interface ActiveEvent {
  id: string;
  name: string;
  durationMonths: number;
  /** Optional metadata used by the event/memorial view. */
  category?: string;
  urgency?: "low" | "normal" | "high";
}

export type MemorialOptionEffect =
  | {
      type: "resource_delta";
      resource: keyof NationalResources;
      amount: number;
    }
  | {
      type: "faction_delta";
      factionId: FactionId;
      satisfaction?: number;
      influence?: number;
      wealth?: number;
      organization?: number;
      resentment?: number;
      fear?: number;
    }
  | {
      type: "province_delta";
      provinceId?: ProvinceId;
      food?: number;
      treasury?: number;
      security?: number;
      morale?: number;
      corruption?: number;
      localLoyalty?: number;
      rebellionRisk?: number;
      gentryInfluence?: number;
      landlordInfluence?: number;
      militaryPresence?: number;
    }
  | {
      type: "state_modifier";
      id: string;
      name: string;
      durationMonths: number;
    }
  | {
      type: "spawn_event";
      eventId: string;
    };

export interface MemorialOption {
  id: string;
  label: string;
  description: string;
  effects: MemorialOptionEffect[];
}

export interface Memorial {
  id: string;
  title: string;
  source: string;
  description: string;
  urgency: "low" | "normal" | "high";
  /** ID of the event definition that produced this memorial. */
  eventId?: string;
  category?: string;
  provinceId?: ProvinceId;
  factionId?: FactionId;
  options: MemorialOption[];
  createdAt?: number;
}

export type CrisisType =
  | "peasant_revolt"
  | "military_coup"
  | "gentry_coup"
  | "landlord_secession"
  | "state_collapse";

export type CrisisStage = "warning" | "critical";

export interface CrisisState {
  type: CrisisType;
  /** 0–100 pressure; 100 means this crisis can end the reign. */
  pressure: number;
  stage: CrisisStage;
  startedAt: number;
  monthsActive: number;
  provinceId?: ProvinceId;
  /** Consecutive shortage/unrest counters used to explain the pressure gauge. */
  foodShortageMonths: number;
  treasuryArrearsMonths: number;
  unrestMonths: number;
  lastIncident?: string;
}

export type EndingReason = "normal_retirement" | CrisisType;

export interface HistoryEntry {
  year: number;
  month: number;
  totalMonths: number;
  actions: string[];
  resourceChanges: Partial<Record<keyof NationalResources, number>>;
  factionChanges: Partial<Record<FactionId, number>>;
  events: string[];
  memorials: string[];
  /** Optional V0.3 diagnostics; old history snapshots remain valid. */
  crisis?: CrisisType;
  pressure?: number;
  shortages?: string[];
}

export interface EndingState {
  reason: EndingReason;
  totalMonths: number;
  crisis?: CrisisState;
  triggerFactionId?: FactionId;
  cause?: string;
  keyLogs?: string[];
}

export interface GameState {
  time: GameTime;
  emperor: EmperorState;
  resources: NationalResources;
  buildings: BuildingState[];
  provinces: ProvinceState[];
  factions: FactionState[];
  activeModifiers: ActiveModifier[];
  activeEvents: ActiveEvent[];
  pendingMemorials: Memorial[];
  /** Current warning/critical national crisis, if any. */
  crisis: CrisisState | null;
  unlockedSkills: string[];
  history: HistoryEntry[];
  ending: EndingState | null;
}
