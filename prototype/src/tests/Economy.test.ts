import { describe, expect, it } from "vitest";
import {
  BUILDING_DEFINITIONS,
  advanceMonth,
  buildBuilding,
  canBuild,
  newGame,
  settleMonthlyEconomy,
} from "../engine/GameEngine";

describe("Prototype economy buildings", () => {
  it("constructs and upgrades a capital building without mutating the input", () => {
    const initial = newGame();
    const first = buildBuilding(initial, "civilian");

    expect(initial.buildings).toEqual([]);
    expect(first.buildings).toEqual([{ id: "civilian", provinceId: "central", level: 1 }]);
    expect(first.resources.treasury).toBe(8_000 - BUILDING_DEFINITIONS.civilian.constructionCost.treasury!);

    const upgradeReady = { ...first, resources: { ...first.resources, treasury: 20_000 } };
    const upgraded = buildBuilding(upgradeReady, "civilian");
    expect(upgraded.buildings[0].level).toBe(2);
    expect(upgraded.resources.treasury).toBe(20_000 - 9_000);
    expect(canBuild(upgraded, "civilian").nextLevel).toBe(3);
  });

  it("settles production and upkeep at the end of each month", () => {
    let state = newGame();
    state = { ...state, resources: { ...state.resources, treasury: 30_000, weapons: 10_000 } };
    state = buildBuilding(state, "civilian");
    state = buildBuilding(state, "barracks");
    state = buildBuilding(state, "kitchen");

    const expected = settleMonthlyEconomy(state);
    const next = advanceMonth(state);
    expect(next.resources).toEqual(expected.resources);
    expect(next.history[0].resourceChanges).toEqual(expected.resourceChanges);
    expect(next.history[0].actions).toContain("州产出与中央征收已结算");
    expect(next.resources.food).toBeGreaterThanOrEqual(0);
    expect(next.resources.army).toBeGreaterThanOrEqual(state.resources.army);
  });

  it("refuses unaffordable builds and clamps upkeep at zero", () => {
    let state = newGame();
    state = buildBuilding(state, "barracks");
    state = { ...state, resources: { ...state.resources, food: 100, army: 100_000 } };
    const next = advanceMonth(state);

    expect(next.resources.food).toBeGreaterThanOrEqual(0);
    expect(next.history[0].shortages).toContain("food");
    expect(next.resources.army).toBeGreaterThanOrEqual(0);
    const unaffordable = { ...state, resources: { ...state.resources, treasury: 0 } };
    expect(buildBuilding(unaffordable, "kitchen")).toBe(unaffordable);
  });
});
