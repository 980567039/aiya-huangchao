import { describe, expect, it } from "vitest";
import { simulateV05Months } from "../engine/V05Simulation";

describe("V0.5 12个月经济压力模拟", () => {
  it("runs the real monthly loop for 12 months without construction", () => {
    const result = simulateV05Months(12, 17);

    expect(result.months.length).toBeGreaterThan(0);
    expect(result.final.totalMonths).toBeLessThanOrEqual(12);
    expect(result.final.food).toBeGreaterThanOrEqual(0);
    expect(result.final.treasury).toBeGreaterThanOrEqual(0);
    expect(result.final.manpower).toBeGreaterThanOrEqual(0);
    expect(result.final.lowestFactionSatisfaction).toBeGreaterThanOrEqual(0);
    expect(result.final.lowestFactionSatisfaction).toBeLessThanOrEqual(100);

    // The point of V0.5 is to reject the old "do nothing and get richer"
    // behavior. A no-build run must not end with a materially larger treasury
    // and food stockpile at the same time.
    const treasuryGrew = result.final.treasury > result.initial.treasury;
    const foodGrew = result.final.food > result.initial.food;
    expect(treasuryGrew && foodGrew).toBe(false);
  });

  it("never allows faction satisfaction to leave the 0-100 range", () => {
    const result = simulateV05Months(12, 31);
    for (const month of result.months) {
      expect(month.lowestFactionSatisfaction).toBeGreaterThanOrEqual(0);
      expect(month.lowestFactionSatisfaction).toBeLessThanOrEqual(100);
    }
  });
});
