import { describe, expect, it } from "vitest";
import { advanceMonth, formatReignDate, newGame } from "../engine/GameEngine";
import { FACTION_IDS, PROVINCE_IDS } from "../engine/GameState";

describe("Prototype V0.3 · 建国危局与五年求生", () => {
  it("creates a complete initial GameState", () => {
    const state = newGame();

    expect(state.time).toEqual({ totalMonths: 0, year: 1, month: 1 });
    expect(state.emperor).toEqual({ age: 20, reignTitle: "景和" });
    expect(formatReignDate(state)).toBe("景和元年·正月");
    expect(state.provinces.map((province) => province.id)).toEqual([...PROVINCE_IDS]);
    expect(state.factions.map((faction) => faction.id)).toEqual([...FACTION_IDS]);
    expect(state.provinces.every((province) => Number.isFinite(province.rebellionRisk))).toBe(true);
    expect(state.factions.every((faction) => Number.isFinite(faction.resentment))).toBe(true);
    expect(state.resources).toEqual({
      treasury: 8000,
      food: 7000,
      weapons: 1200,
      army: 1800,
      authority: 45,
      morale: 42,
    });
  });

  it("advances one calendar month without mutating the previous state", () => {
    const initial = newGame();
    const next = advanceMonth(initial);

    expect(initial.time).toEqual({ totalMonths: 0, year: 1, month: 1 });
    expect(next.time).toEqual({ totalMonths: 1, year: 1, month: 2 });
    expect(formatReignDate(next)).toBe("景和元年·二月");
    expect(next.emperor.age).toBe(20);
    expect(next.history).toHaveLength(1);
  });

  it("rolls 12 advances into year 2 month 1 and ages the emperor by one year", () => {
    let state = newGame();
    for (let index = 0; index < 12; index += 1) {
      state = advanceMonth(state);
    }

    expect(state.time).toEqual({ totalMonths: 12, year: 2, month: 1 });
    expect(state.emperor.age).toBe(21);
    expect(formatReignDate(state)).toBe("景和2年·正月");
    expect(state.history).toHaveLength(12);
  });

  it("ends normally after 360 months and ignores further advances", () => {
    let state = newGame();
    state = {
      ...state,
      resources: { treasury: 100_000, food: 100_000, weapons: 100_000, army: 1_800, authority: 100, morale: 100 },
      provinces: state.provinces.map((province) => ({ ...province, security: 100, morale: 100, corruption: 0, localLoyalty: 100, rebellionRisk: 0 })),
      factions: state.factions.map((faction) => ({ ...faction, satisfaction: 95, resentment: 0 })),
    };
    for (let index = 0; index < 360; index += 1) {
      state = advanceMonth(state);
      // This test isolates the calendar's normal-retirement branch; event
      // choices are covered by EventEngine tests and are intentionally not
      // allowed to contaminate the long-horizon clock assertion.
      state = { ...state, pendingMemorials: [], activeEvents: [], crisis: null };
      if (state.ending) break;
    }

    expect(state.time).toEqual({ totalMonths: 360, year: 31, month: 1 });
    expect(state.emperor.age).toBe(50);
    expect(state.ending).toMatchObject({ reason: "normal_retirement", totalMonths: 360 });
    expect(advanceMonth(state)).toBe(state);
  });
});
