import type { DatabaseSync } from "node:sqlite";
import { sampleDailyWeights, type WeightObservation } from "@nutrition-tracker/body";

export class AnalyticsError extends Error {
  constructor(readonly code: "ANALYTICS_INVALID_INPUT") {
    super(code);
    this.name = "AnalyticsError";
  }
}

export type DailySummaryInput = {
  localDate: string;
  intakeKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  goalKcal: number | null;
};

export type AnalyticsOverview = {
  period: { from: string; to: string; days: number };
  recordCoverage: { recordedDays: number; totalDays: number; ratio: number };
  averages: { intakeKcal: number | null; proteinG: number | null; fatG: number | null; carbG: number | null };
  goal: { days: number; averageKcal: number | null; averageDifferenceKcal: number | null };
  weight: { observedDays: number; startKg: number | null; endKg: number | null; deltaKg: number | null };
};

export type AdaptiveTdeeResult = {
  methodVersion: "adaptive_tdee_v1";
  status: "estimated" | "insufficient_data" | "throttled";
  reason: "insufficient_data" | "update_throttled" | null;
  rawTdeeKcal: number | null;
  estimatedTdeeKcal: number | null;
  confidence: number;
  recommendedCalorieTargetKcal: null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateEpoch(value: string) {
  if (!DATE_RE.test(value)) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
  return date.getTime();
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildAnalyticsOverview(input: { from: string; to: string; daily: readonly DailySummaryInput[]; weights: readonly WeightObservation[] }): AnalyticsOverview {
  const fromEpoch = dateEpoch(input.from);
  const toEpoch = dateEpoch(input.to);
  if (fromEpoch > toEpoch) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
  const totalDays = Math.floor((toEpoch - fromEpoch) / 86_400_000) + 1;
  const seenDates = new Set<string>();
  for (const row of input.daily) {
    if (dateEpoch(row.localDate) < fromEpoch || dateEpoch(row.localDate) > toEpoch || seenDates.has(row.localDate) || !nonNegative(row.intakeKcal) || !nonNegative(row.proteinG) || !nonNegative(row.fatG) || !nonNegative(row.carbG) || (row.goalKcal !== null && !nonNegative(row.goalKcal))) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
    seenDates.add(row.localDate);
  }
  const recordedDays = input.daily.length;
  const average = (values: number[]) => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  const intakeKcal = average(input.daily.map((row) => row.intakeKcal));
  const proteinG = average(input.daily.map((row) => row.proteinG));
  const fatG = average(input.daily.map((row) => row.fatG));
  const carbG = average(input.daily.map((row) => row.carbG));
  const goals = input.daily.filter((row) => row.goalKcal !== null);
  const goalAverage = average(goals.map((row) => row.goalKcal!));
  const goalDifference = average(goals.map((row) => row.intakeKcal - row.goalKcal!));
  const weights = input.weights.filter((weight) => { const epoch = dateEpoch(weight.localDate); return epoch >= fromEpoch && epoch <= toEpoch; });
  const sampled = sampleDailyWeights(weights, "last");
  const startKg = sampled[0]?.weightKg ?? null;
  const endKg = sampled[sampled.length - 1]?.weightKg ?? null;
  return {
    period: { from: input.from, to: input.to, days: totalDays },
    recordCoverage: { recordedDays, totalDays, ratio: recordedDays / totalDays },
    averages: { intakeKcal, proteinG, fatG, carbG },
    goal: { days: goals.length, averageKcal: goalAverage, averageDifferenceKcal: goalDifference },
    weight: { observedDays: sampled.length, startKg, endKg, deltaKg: startKg === null || endKg === null ? null : endKg - startKg },
  };
}

export function estimateAdaptiveTdee(input: {
  periodDays: number;
  averageIntakeKcal: number;
  startTrendWeightKg: number;
  endTrendWeightKg: number;
  weightMeasurementCount: number;
  diaryCoverage: number;
  asOfDate: string;
  previousEstimateKcal?: number;
  lastUpdatedDate?: string;
}): AdaptiveTdeeResult {
  const asOfEpoch = dateEpoch(input.asOfDate);
  if (!Number.isInteger(input.periodDays) || input.periodDays <= 0 || !nonNegative(input.averageIntakeKcal) || !nonNegative(input.startTrendWeightKg) || !nonNegative(input.endTrendWeightKg) || !Number.isInteger(input.weightMeasurementCount) || input.weightMeasurementCount < 0 || !Number.isFinite(input.diaryCoverage) || input.diaryCoverage < 0 || input.diaryCoverage > 1 || (input.previousEstimateKcal !== undefined && !positive(input.previousEstimateKcal)) || (input.lastUpdatedDate !== undefined && dateEpoch(input.lastUpdatedDate) > asOfEpoch)) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
  const confidence = Math.min(1, input.periodDays / 28, input.weightMeasurementCount / 10, input.diaryCoverage);
  const sufficient = input.periodDays >= 21 && input.weightMeasurementCount >= 8 && input.diaryCoverage >= 0.7;
  if (!sufficient) return { methodVersion: "adaptive_tdee_v1", status: "insufficient_data", reason: "insufficient_data", rawTdeeKcal: null, estimatedTdeeKcal: null, confidence: 0, recommendedCalorieTargetKcal: null };
  const rawTdeeKcal = input.averageIntakeKcal - ((input.endTrendWeightKg - input.startTrendWeightKg) * 7700) / input.periodDays;
  if (!positive(rawTdeeKcal)) throw new AnalyticsError("ANALYTICS_INVALID_INPUT");
  if (input.previousEstimateKcal !== undefined && input.lastUpdatedDate !== undefined) {
    const daysSinceUpdate = (asOfEpoch - dateEpoch(input.lastUpdatedDate)) / 86_400_000;
    if (daysSinceUpdate < 7) return { methodVersion: "adaptive_tdee_v1", status: "throttled", reason: "update_throttled", rawTdeeKcal, estimatedTdeeKcal: input.previousEstimateKcal, confidence, recommendedCalorieTargetKcal: null };
  }
  const estimatedTdeeKcal = input.previousEstimateKcal === undefined ? rawTdeeKcal : 0.7 * input.previousEstimateKcal + 0.3 * rawTdeeKcal;
  return { methodVersion: "adaptive_tdee_v1", status: "estimated", reason: null, rawTdeeKcal, estimatedTdeeKcal, confidence, recommendedCalorieTargetKcal: null };
}

export function createAnalyticsService(sqlite: DatabaseSync) {
  function getOverview(input: { userId: string; from: string; to: string }) {
    const daily = sqlite.prepare("SELECT local_date localDate,intake_kcal intakeKcal,protein_g proteinG,fat_g fatG,carb_g carbG,goal_kcal goalKcal FROM analytics_daily_summary WHERE user_id=? AND local_date>=? AND local_date<=? ORDER BY local_date").all(input.userId, input.from, input.to) as DailySummaryInput[];
    const weights = sqlite.prepare("SELECT local_date localDate,measured_at measuredAt,weight_kg weightKg FROM body_weight_entry WHERE user_id=? AND local_date>=? AND local_date<=? ORDER BY measured_at,id").all(input.userId, input.from, input.to) as WeightObservation[];
    return buildAnalyticsOverview({ from: input.from, to: input.to, daily, weights });
  }

  function getAdaptiveTdee(input: { userId: string; from: string; to: string; asOfDate?: string }) {
    const overview = getOverview(input);
    const weightCount = sqlite.prepare("SELECT count(*) count FROM body_weight_entry WHERE user_id=? AND local_date>=? AND local_date<=?").get(input.userId, input.from, input.to) as { count: number };
    return {
      ...estimateAdaptiveTdee({
        periodDays: overview.period.days,
        averageIntakeKcal: overview.averages.intakeKcal ?? 0,
        startTrendWeightKg: overview.weight.startKg ?? 0,
        endTrendWeightKg: overview.weight.endKg ?? 0,
        weightMeasurementCount: Number(weightCount.count),
        diaryCoverage: overview.recordCoverage.ratio,
        asOfDate: input.asOfDate ?? input.to,
      }),
      period: { from: input.from, to: input.to },
    };
  }

  return { getOverview, getAdaptiveTdee };
}
