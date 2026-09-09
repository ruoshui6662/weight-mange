import { describe, expect, it } from "vitest";
import { AnalyticsError, buildAnalyticsOverview } from "../src/index.js";

describe("analytics overview", () => {
  it("averages recorded summaries and reports coverage, goal difference and weight change", () => {
    expect(buildAnalyticsOverview({
      from: "2026-01-01",
      to: "2026-01-03",
      daily: [
        { localDate: "2026-01-01", intakeKcal: 1800, proteinG: 100, fatG: 60, carbG: 200, goalKcal: 2000 },
        { localDate: "2026-01-03", intakeKcal: 2200, proteinG: 120, fatG: 70, carbG: 240, goalKcal: 2000 },
      ],
      weights: [
        { localDate: "2026-01-01", measuredAt: 100, weightKg: 70 },
        { localDate: "2026-01-03", measuredAt: 200, weightKg: 69.5 },
      ],
    })).toEqual({
      period: { from: "2026-01-01", to: "2026-01-03", days: 3 },
      recordCoverage: { recordedDays: 2, totalDays: 3, ratio: 2 / 3 },
      averages: { intakeKcal: 2000, proteinG: 110, fatG: 65, carbG: 220 },
      goal: { days: 2, averageKcal: 2000, averageDifferenceKcal: 0 },
      weight: { observedDays: 2, startKg: 70, endKg: 69.5, deltaKg: -0.5 },
    });
  });

  it("keeps insufficient data explicit instead of fabricating averages", () => {
    expect(buildAnalyticsOverview({ from: "2026-01-01", to: "2026-01-03", daily: [], weights: [] })).toEqual({
      period: { from: "2026-01-01", to: "2026-01-03", days: 3 },
      recordCoverage: { recordedDays: 0, totalDays: 3, ratio: 0 },
      averages: { intakeKcal: null, proteinG: null, fatG: null, carbG: null },
      goal: { days: 0, averageKcal: null, averageDifferenceKcal: null },
      weight: { observedDays: 0, startKg: null, endKg: null, deltaKg: null },
    });
  });

  it("rejects reversed periods and invalid summary values", () => {
    expect(() => buildAnalyticsOverview({ from: "2026-01-03", to: "2026-01-01", daily: [], weights: [] })).toThrow(new AnalyticsError("ANALYTICS_INVALID_INPUT"));
    expect(() => buildAnalyticsOverview({ from: "2026-01-01", to: "2026-01-03", daily: [{ localDate: "2026-01-02", intakeKcal: -1, proteinG: 0, fatG: 0, carbG: 0, goalKcal: null }], weights: [] })).toThrow(new AnalyticsError("ANALYTICS_INVALID_INPUT"));
  });
});
