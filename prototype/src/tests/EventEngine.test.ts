import { describe, expect, it } from "vitest";
import {
  advanceMonth,
  newGame,
  resolveMemorial,
} from "../engine/GameEngine";

describe("Prototype event loop", () => {
  it("offers a guaranteed first-month memorial with multiple meaningful choices", () => {
    const state = advanceMonth(newGame());

    expect(state.pendingMemorials).toHaveLength(1);
    const memorial = state.pendingMemorials[0];
    expect(memorial.eventId).toBe("EV000");
    expect(memorial.options.length).toBeGreaterThanOrEqual(2);
    expect(state.activeEvents[0]?.id).toBe("EV000");
    expect(state.history[0].events).toContain("EV000");
    expect(state.history[0].memorials).toContain(memorial.id);
  });

  it("resolves a choice through the engine and records resource/faction effects", () => {
    const state = advanceMonth(newGame());
    const memorial = state.pendingMemorials[0];
    const peasantsBefore = state.factions.find((faction) => faction.id === "peasants")!.satisfaction;
    const option = memorial.options.find((item) => item.id === "open_granary")!;
    const foodDelta = option.effects.find((effect) => effect.type === "resource_delta" && effect.resource === "food");
    const moraleDelta = option.effects.find((effect) => effect.type === "resource_delta" && effect.resource === "morale");
    const factionDelta = option.effects.find((effect) => effect.type === "faction_delta" && effect.factionId === "peasants");
    const resolved = resolveMemorial(state, memorial.id, option.id);

    expect(resolved.pendingMemorials).toHaveLength(0);
    expect(resolved.resources.food).toBe(state.resources.food + (foodDelta?.type === "resource_delta" ? foodDelta.amount : 0));
    expect(resolved.resources.morale).toBe(state.resources.morale + (moraleDelta?.type === "resource_delta" ? moraleDelta.amount : 0));
    expect(resolved.factions.find((faction) => faction.id === "peasants")!.satisfaction).toBe(
      peasantsBefore + (factionDelta?.type === "faction_delta" ? factionDelta.satisfaction ?? 0 : 0),
    );
    expect(resolved.history[0].actions.some((action) => action.includes(option.label))).toBe(true);
    expect(resolved.history[0].resourceChanges.food).toBe(
      (state.history[0].resourceChanges.food ?? 0) + (foodDelta?.type === "resource_delta" ? foodDelta.amount : 0),
    );
    expect(resolved.history[0].factionChanges.peasants).toBeGreaterThanOrEqual(factionDelta?.type === "faction_delta" ? factionDelta.satisfaction ?? 0 : 0);
  });

  it("keeps a readable docket: every month has events and pressure increases density", () => {
    let state = advanceMonth(newGame());
    state = resolveMemorial(state, state.pendingMemorials[0].id, "observe_first");
    const monthTwo = advanceMonth(state);
    expect(monthTwo.time.totalMonths).toBe(2);
    expect(monthTwo.pendingMemorials.length).toBeGreaterThanOrEqual(1);

    const monthThree = advanceMonth(monthTwo);
    expect(monthThree.time.totalMonths).toBe(3);
    expect(monthThree.pendingMemorials.length).toBeGreaterThanOrEqual(monthTwo.pendingMemorials.length);
    expect(monthThree.history[2].events.length).toBeGreaterThanOrEqual(1);
  });

  it("creates a follow-up memorial when an option explicitly spawns one", () => {
    const initial = newGame();
    const eventState = advanceMonth(initial);
    // The follow-up hook is data-driven; exercise it with a tiny synthetic
    // memorial so this test does not depend on which random event was drawn.
    const sourceMemorial = eventState.pendingMemorials[0];
    const syntheticState = {
      ...eventState,
      pendingMemorials: [{
        ...sourceMemorial,
        id: "synthetic-chain",
        options: [{
          id: "escalate",
          label: "升级处理",
          description: "触发后续急报。",
          effects: [{ type: "spawn_event" as const, eventId: "EV005" }],
        }],
      }],
    };
    const resolved = resolveMemorial(syntheticState, "synthetic-chain", "escalate");
    expect(resolved.pendingMemorials.some((memorial) => memorial.eventId === "EV005")).toBe(true);
    expect(resolved.pendingMemorials.every((memorial) => memorial.options.length >= 2)).toBe(true);
  });
});
