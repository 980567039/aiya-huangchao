import { describe, expect, it } from "vitest";
import {
  advanceMonth,
  calculateCrisisPressure,
  centralCollectionEfficiency,
  newGame,
  settleMonthlyEconomyDetailed,
} from "../engine/GameEngine";

describe("Prototype V0.3 · 国家经济与危机", () => {
  it("starts with a young emperor and a tight, brittle reserve", () => {
    const state = newGame();
    expect(state.emperor.age).toBe(20);
    expect(state.resources).toEqual({
      treasury: 8_000,
      food: 7_000,
      weapons: 1_200,
      army: 1_800,
      authority: 45,
      morale: 42,
    });
    expect(state.crisis).toBeNull();
    expect(state.provinces.every((province) => province.security <= 65)).toBe(true);
    expect(state.provinces.every((province) => province.morale <= 60)).toBe(true);
    expect(state.provinces.every((province) => province.corruption >= 43)).toBe(true);
    expect(state.provinces.every((province) => province.rebellionRisk >= 12)).toBe(true);
  });

  it("collects provincial production before paying national upkeep", () => {
    const state = newGame();
    const settlement = settleMonthlyEconomyDetailed(state);
    expect(settlement.provincialProduction).toHaveLength(5);
    expect(settlement.collectionEfficiency).toBeGreaterThanOrEqual(0.2);
    expect(settlement.collectionEfficiency).toBeLessThanOrEqual(0.9);
    expect(settlement.resources.food).toBeGreaterThan(state.resources.food);
    expect(settlement.resources.treasury).toBeGreaterThan(state.resources.treasury);
    expect(settlement.resourceChanges.food).toBeGreaterThan(0);
    expect(settlement.resourceChanges.treasury).toBeGreaterThan(0);
    expect(centralCollectionEfficiency(state)).toBe(settlement.collectionEfficiency);
  });

  it("turns food and treasury shortfalls into political and provincial damage", () => {
    const base = newGame();
    const state = {
      ...base,
      resources: { ...base.resources, food: 0, treasury: 0, army: 100_000 },
      provinces: base.provinces.map((province) => ({ ...province, population: 0, treasury: 0 })),
    };
    const settlement = settleMonthlyEconomyDetailed(state);
    expect(settlement.shortages).toEqual(expect.arrayContaining(["food", "treasury"]));
    expect(settlement.resources.food).toBeGreaterThanOrEqual(0);
    expect(settlement.resources.treasury).toBeGreaterThanOrEqual(0);
    const peasantsBefore = state.factions.find((faction) => faction.id === "peasants")!.satisfaction;
    expect(settlement.factions.find((faction) => faction.id === "peasants")!.satisfaction).toBeLessThan(peasantsBefore);
    expect(settlement.provinces[0].security).toBeLessThan(state.provinces[0].security);
  });

  it("does not make a lethal crisis check before month four", () => {
    const hostile = {
      ...newGame(),
      resources: { treasury: 0, food: 0, weapons: 0, army: 0, authority: 0, morale: 0 },
      factions: newGame().factions.map((faction) => ({ ...faction, satisfaction: 0, resentment: 100 })),
      provinces: newGame().provinces.map((province) => ({ ...province, security: 20, morale: 20, rebellionRisk: 100 })),
    };
    let state = hostile;
    for (let month = 0; month < 3; month += 1) state = advanceMonth(state);
    expect(state.ending).toBeNull();
    expect(state.crisis).toBeNull();
    state = advanceMonth(state);
    expect(state.crisis).not.toBeNull();
    expect(calculateCrisisPressure(state).state_collapse).toBeGreaterThan(0);
  });

  it("allows an extreme neglect path to end within five years", () => {
    const base = newGame();
    let state = {
      ...base,
      resources: { treasury: 0, food: 0, weapons: 0, army: 0, authority: 0, morale: 0 },
      factions: base.factions.map((faction) => ({ ...faction, satisfaction: 0, resentment: 100 })),
      provinces: base.provinces.map((province) => ({ ...province, security: 20, morale: 20, rebellionRisk: 100 })),
    };
    for (let month = 0; month < 60 && !state.ending; month += 1) state = advanceMonth(state);
    expect(state.ending).not.toBeNull();
    expect(state.time.totalMonths).toBeLessThanOrEqual(60);
    expect(state.ending?.reason).not.toBe("normal_retirement");
  });
});
