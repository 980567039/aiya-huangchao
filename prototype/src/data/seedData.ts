import rawFactions from "../../../data/factions.json";
import rawNationalResources from "../../../data/national_resources.json";
import rawProvinces from "../../../data/provinces.json";
import { FACTION_IDS, PROVINCE_IDS, REIGN_TITLE, STARTING_AGE, type FactionId, type FactionState, type GameState, type NationalResources, type ProvinceId, type ProvinceState } from "../engine/GameState";
type RawFaction = { id:string; name:string; satisfaction:number; influence:number; wealth:number; organization:number; resentment:number; fear:number };
type RawProvince = { id:string; name:string; population:number; food:number; treasury:number; security:number; morale:number; corruption:number; local_loyalty:number; gentry_influence:number; landlord_influence:number; garrison:number; rebellion_risk:number };
type RawNationalResources = { treasury:number; food:number; weapons:number; army:number; authority:number; morale:number; manpower:number };
const rawFactionList = rawFactions.factions as RawFaction[];
const rawProvinceList = rawProvinces.provinces as RawProvince[];
const initialResources = rawNationalResources.resources as RawNationalResources;
const asProvinceId = (id:string):ProvinceId => { if (!PROVINCE_IDS.includes(id as ProvinceId)) throw new Error(`Unknown province id: ${id}`); return id as ProvinceId; };
const asFactionId = (id:string):FactionId => { if (!FACTION_IDS.includes(id as FactionId)) throw new Error(`Unknown faction id: ${id}`); return id as FactionId; };
function createProvinces():ProvinceState[]{ return rawProvinceList.map(p=>({id:asProvinceId(p.id),name:p.name,population:p.population,food:p.food,treasury:p.treasury,security:p.security,morale:p.morale,corruption:p.corruption,localLoyalty:p.local_loyalty,rebellionRisk:p.rebellion_risk,gentryInfluence:p.gentry_influence,landlordInfluence:p.landlord_influence,militaryPresence:p.garrison})); }
function createFactions():FactionState[]{ return FACTION_IDS.map(id=>{const raw=rawFactionList.find(f=>f.id===id); if(!raw) throw new Error(`Missing faction ${id}`); return {id:asFactionId(raw.id),name:raw.name,satisfaction:raw.satisfaction,influence:raw.influence,wealth:raw.wealth,organization:raw.organization,resentment:raw.resentment,fear:raw.fear};}); }
export function newGame():GameState { return {time:{totalMonths:0,year:1,month:1},emperor:{age:STARTING_AGE,reignTitle:REIGN_TITLE},resources:{...initialResources},buildings:[],provinces:createProvinces(),factions:createFactions(),activeModifiers:[],activeEvents:[],pendingMemorials:[],crisis:null,unlockedSkills:[],history:[],ending:null}; }
