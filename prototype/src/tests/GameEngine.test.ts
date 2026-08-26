import { describe, expect, it } from "vitest";
import { advanceMonth, formatReignDate, newGame } from "../engine/GameEngine";
import { FACTION_IDS, PROVINCE_IDS } from "../engine/GameState";

describe("Prototype V0.1 · Sprint 1", () => {
  it("creates a complete initial GameState", () => {
    const state = newGame();

    expect(state.time).toEqual({ totalMonths: 0, year: 1, month: 1 });
    expect(state.emperor).toEqual({ age: 30, reignTitle: "景和" });
    expect(formatReignDate(state)).toBe("景和元年·正月");
    expect(state.provinces.map((province) => province.id)).toEqual([...PROVINCE_IDS]);
    expect(state.factions.map((faction) => faction.id)).toEqual([...FACTION_IDS]);
    expect(state.provinces.every((province) => Number.isFinite(province.rebellionRisk))).toBe(true);
    expect(state.factions.every((faction) => Number.isFinite(faction.resentment))).toBe(true);
    expect(state.resources).toEqual({
      treasury: 32000,
      food: 30000,
      weapons: 6000,
      army: 5400,
      authority: 68,
      morale: 61,
    });
  });

  it("advances one calendar month without mutating the previous state", () => {
    const initial = newGame();
    const next = advanceMonth(initial);

    expect(initial.time).toEqual({ totalMonths: 0, year: 1, month: 1 });
    expect(next.time).toEqual({ totalMonths: 1, year: 1, month: 2 });
    expect(formatReignDate(next)).toBe("景和元年·二月");
    expect(next.emperor.age).toBe(30);
    expect(next.history).toHaveLength(1);
  });

  it("rolls 12 advances into year 2 month 1 and ages the emperor by one year", () => {
    let state = newGame();
    for (let index = 0; index < 12; index += 1) {
      state = advanceMonth(state);
    }

    expect(state.time).toEqual({ totalMonths: 12, year: 2, month: 1 });
    expect(state.emperor.age).toBe(31);
    expect(formatReignDate(state)).toBe("景和2年·正月");
    expect(state.history).toHaveLength(12);
  });

  it("ends normally after 360 months and ignores further advances", () => {
    let state = newGame();
    for (let index = 0; index < 360; index += 1) {
      state = advanceMonth(state);
    }

    expect(state.time).toEqual({ totalMonths: 360, year: 31, month: 1 });
    expect(state.emperor.age).toBe(60);
    expect(state.ending).toEqual({ reason: "normal_retirement", totalMonths: 360 });
    expect(advanceMonth(state)).toBe(state);
  });
});
