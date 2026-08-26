import {
  GAME_MONTHS,
  MONTHS_PER_YEAR,
  type GameState,
  type HistoryEntry,
} from "./GameState";

export function formatReignDate(state: Pick<GameState, "time" | "emperor">): string {
  const yearLabel = state.time.year === 1 ? "元" : String(state.time.year);
  const monthLabels = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  const monthLabel = monthLabels[state.time.month - 1] ?? String(state.time.month);
  return `${state.emperor.reignTitle}${yearLabel}年·${monthLabel}月`;
}

function advanceDurations<T extends { durationMonths: number }>(items: T[]): T[] {
  return items
    .map((item) => ({ ...item, durationMonths: Math.max(0, item.durationMonths - 1) }))
    .filter((item) => item.durationMonths > 0);
}

function createMonthHistory(state: GameState): HistoryEntry {
  return {
    year: state.time.year,
    month: state.time.month,
    totalMonths: state.time.totalMonths,
    actions: [],
    resourceChanges: {},
    factionChanges: {},
    events: [],
    memorials: [],
  };
}

/**
 * Sprint 1's monthly loop only advances the calendar and expires existing durations.
 * Production, upkeep, events and player actions are intentionally added in later sprints.
 */
export function advanceMonth(state: GameState): GameState {
  if (state.ending) {
    return state;
  }

  const totalMonths = state.time.totalMonths + 1;
  const nextTime = {
    totalMonths,
    year: Math.floor(totalMonths / MONTHS_PER_YEAR) + 1,
    month: (totalMonths % MONTHS_PER_YEAR) + 1,
  };
  const nextState: GameState = {
    ...state,
    time: nextTime,
    emperor: {
      ...state.emperor,
      age: state.emperor.age + (nextTime.month === 1 ? 1 : 0),
    },
    activeModifiers: advanceDurations(state.activeModifiers),
    activeEvents: advanceDurations(state.activeEvents),
    history: [...state.history, createMonthHistory({ ...state, time: nextTime })],
  };

  if (totalMonths >= GAME_MONTHS) {
    nextState.ending = { reason: "normal_retirement", totalMonths };
  }

  return nextState;
}
