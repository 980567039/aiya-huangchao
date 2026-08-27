import rawFactions from "../../../data/factions.json";
import rawProvinces from "../../../data/provinces.json";
import {
  FACTION_IDS,
  PROVINCE_IDS,
  REIGN_TITLE,
  STARTING_AGE,
  type FactionId,
  type FactionState,
  type GameState,
  type NationalResources,
  type ProvinceId,
  type ProvinceState,
} from "../engine/GameState";

type RawFaction = {
  id: string;
  name: string;
  satisfaction: number;
  influence: number;
};

type RawProvince = {
  id: string;
  name: string;
  population: number;
  food: number;
  treasury: number;
  security: number;
  morale: number;
  corruption: number;
  local_loyalty: number;
  gentry_influence: number;
  landlord_influence: number;
  garrison: number;
};

const rawFactionList = rawFactions.factions as RawFaction[];
const rawProvinceList = rawProvinces.provinces as RawProvince[];

const factionDefaults: Record<
  FactionId,
  Pick<FactionState, "wealth" | "organization" | "resentment" | "fear">
> = {
  gentry: { wealth: 72, organization: 68, resentment: 8, fear: 8 },
  military: { wealth: 58, organization: 76, resentment: 10, fear: 12 },
  peasants: { wealth: 40, organization: 36, resentment: 12, fear: 5 },
  landlords: { wealth: 84, organization: 62, resentment: 9, fear: 10 },
};

const initialResources: NationalResources = {
  // V0.3 deliberately starts tight: building an economy is a meaningful
  // opening decision, while a few months of reserve still remain.
  treasury: 8_000,
  food: 7_000,
  weapons: 1_200,
  army: 1_800,
  authority: 45,
  morale: 42,
};

const asProvinceId = (id: string): ProvinceId => {
  if (!PROVINCE_IDS.includes(id as ProvinceId)) {
    throw new Error(`Unknown province id in data/provinces.json: ${id}`);
  }
  return id as ProvinceId;
};

const asFactionId = (id: string): FactionId => {
  if (!FACTION_IDS.includes(id as FactionId)) {
    throw new Error(`Unknown prototype faction id in data/factions.json: ${id}`);
  }
  return id as FactionId;
};

function createProvinces(): ProvinceState[] {
  return rawProvinceList
    .filter((province) => PROVINCE_IDS.includes(province.id as ProvinceId))
    .map((province) => ({
      id: asProvinceId(province.id),
      name: province.name,
      population: province.population,
      food: province.food,
      treasury: province.treasury,
      // The new emperor inherits a country that is functional, but brittle:
      // low security/morale and elevated corruption make early choices matter.
      security: Math.max(20, province.security - 10),
      morale: Math.max(20, province.morale - 10),
      corruption: Math.min(90, province.corruption + 8),
      localLoyalty: province.local_loyalty,
      rebellionRisk: 12,
      gentryInfluence: province.gentry_influence,
      landlordInfluence: province.landlord_influence,
      militaryPresence: province.garrison,
    }));
}

function createFactions(): FactionState[] {
  // The prototype deliberately keeps 皇权 as a national resource (authority), not a fifth faction.
  return FACTION_IDS.map((id) => {
    const raw = rawFactionList.find((faction) => faction.id === id);
    if (!raw) {
      throw new Error(`Missing faction ${id} in data/factions.json`);
    }
    return {
      id: asFactionId(raw.id),
      name: raw.name,
      // The founding court is already fractured.  Raw faction data describes
      // the pre-war baseline; the new emperor starts fifteen points below it.
      satisfaction: Math.max(20, raw.satisfaction - 15),
      influence: raw.influence,
      ...factionDefaults[id],
    };
  });
}

export function newGame(): GameState {
  return {
    time: { totalMonths: 0, year: 1, month: 1 },
    emperor: { age: STARTING_AGE, reignTitle: REIGN_TITLE },
    resources: { ...initialResources },
    // The capital starts undeveloped so the first decisions are construction
    // choices rather than an automatic stream of resources.
    buildings: [],
    provinces: createProvinces(),
    factions: createFactions(),
    activeModifiers: [],
    activeEvents: [],
    pendingMemorials: [],
    crisis: null,
    unlockedSkills: [],
    history: [],
    ending: null,
  };
}
