import { describe, expect, it } from "vitest";
import { AnalyticsError, buildAnalyticsOverview, estimateAdaptiveTdee } from "../src/index.js";

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

  it("estimates adaptive TDEE from intake and trend weight with a fixed version", () => {
    expect(estimateAdaptiveTdee({ periodDays: 28, averageIntakeKcal: 2000, startTrendWeightKg: 70, endTrendWeightKg: 69, weightMeasurementCount: 10, diaryCoverage: 1, asOfDate: "2026-01-29" })).toEqual({
      methodVersion: "adaptive_tdee_v1",
      status: "estimated",
      reason: null,
      rawTdeeKcal: 2275,
      estimatedTdeeKcal: 2275,
      confidence: 1,
      recommendedCalorieTargetKcal: null,
    });
  });

  it("does not estimate with insufficient data and smooths eligible updates", () => {
    expect(estimateAdaptiveTdee({ periodDays: 20, averageIntakeKcal: 2000, startTrendWeightKg: 70, endTrendWeightKg: 69, weightMeasurementCount: 7, diaryCoverage: 1, asOfDate: "2026-01-21" })).toMatchObject({ status: "insufficient_data", reason: "insufficient_data", estimatedTdeeKcal: null, confidence: 0 });
    expect(estimateAdaptiveTdee({ periodDays: 28, averageIntakeKcal: 2000, startTrendWeightKg: 70, endTrendWeightKg: 69, weightMeasurementCount: 10, diaryCoverage: 1, previousEstimateKcal: 2200, asOfDate: "2026-01-29" })).toMatchObject({ status: "estimated", rawTdeeKcal: 2275, estimatedTdeeKcal: 2222.5 });
  });

  it("throttles updates for seven days and never proposes an automatic target", () => {
    expect(estimateAdaptiveTdee({ periodDays: 28, averageIntakeKcal: 2000, startTrendWeightKg: 70, endTrendWeightKg: 69, weightMeasurementCount: 10, diaryCoverage: 1, previousEstimateKcal: 2200, asOfDate: "2026-01-29", lastUpdatedDate: "2026-01-25" })).toMatchObject({ status: "throttled", reason: "update_throttled", estimatedTdeeKcal: 2200, recommendedCalorieTargetKcal: null });
  });
});
