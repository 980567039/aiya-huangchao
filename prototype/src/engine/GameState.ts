export const MONTHS_PER_YEAR = 12;
export const GAME_MONTHS = 360;
export const STARTING_AGE = 30;
export const REIGN_TITLE = "景和";

export const PROVINCE_IDS = [
  "north_shuo",
  "he_dong",
  "central",
  "jiangnan",
  "lingnan",
] as const;

export const FACTION_IDS = ["gentry", "military", "peasants", "landlords"] as const;

export type ProvinceId = (typeof PROVINCE_IDS)[number];
export type FactionId = (typeof FACTION_IDS)[number];

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
}

export interface Memorial {
  id: string;
  title: string;
  source: string;
  description: string;
  urgency: "low" | "normal" | "high";
}

export interface HistoryEntry {
  year: number;
  month: number;
  totalMonths: number;
  actions: string[];
  resourceChanges: Partial<Record<keyof NationalResources, number>>;
  factionChanges: Partial<Record<FactionId, number>>;
  events: string[];
  memorials: string[];
}

export interface EndingState {
  reason: "normal_retirement";
  totalMonths: number;
}

export interface GameState {
  time: GameTime;
  emperor: EmperorState;
  resources: NationalResources;
  provinces: ProvinceState[];
  factions: FactionState[];
  activeModifiers: ActiveModifier[];
  activeEvents: ActiveEvent[];
  pendingMemorials: Memorial[];
  unlockedSkills: string[];
  history: HistoryEntry[];
  ending: EndingState | null;
}
