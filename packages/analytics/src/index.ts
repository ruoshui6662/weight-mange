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

export function createAnalyticsService(sqlite: DatabaseSync) {
  function getOverview(input: { userId: string; from: string; to: string }) {
    const daily = sqlite.prepare("SELECT local_date localDate,intake_kcal intakeKcal,protein_g proteinG,fat_g fatG,carb_g carbG,goal_kcal goalKcal FROM analytics_daily_summary WHERE user_id=? AND local_date>=? AND local_date<=? ORDER BY local_date").all(input.userId, input.from, input.to) as DailySummaryInput[];
    const weights = sqlite.prepare("SELECT local_date localDate,measured_at measuredAt,weight_kg weightKg FROM body_weight_entry WHERE user_id=? AND local_date>=? AND local_date<=? ORDER BY measured_at,id").all(input.userId, input.from, input.to) as WeightObservation[];
    return buildAnalyticsOverview({ from: input.from, to: input.to, daily, weights });
  }

  return { getOverview };
}
