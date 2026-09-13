import type { DatabaseSync } from "node:sqlite";
import { createDiaryService, type DiaryError } from "@nutrition-tracker/diary";

const DASHBOARD_CALC_VERSION = "dashboard_v1";
type Options = { now?: () => number };
type NutrientSummary = { amount: number; coverage: number; hasTrace: boolean; hasEstimated: boolean };
type MealTotals = { nutrients?: Record<string, NutrientSummary> };
type Goal = { kcal: number; proteinG: number | null; fatG: number | null; carbG: number | null; fiberG: number | null };
export type Dashboard = {
  date: string;
  goal: Goal | null;
  intake: { kcal: number; proteinG: number; fatG: number; carbG: number; fiberG: number | null };
  coverage: Record<string, Omit<NutrientSummary, "amount">>;
  exercise: { burnKcal: number; creditKcal: number; available: false };
  remainingKcal: number | null;
  meals: Array<{ key: string; displayName: string; totals: { kcal: number } }>;
};

export class DashboardError extends Error { constructor(readonly code: string, readonly details?: Record<string, unknown>) { super(code); } }

const validDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const parsed = new Date(0); parsed.setUTCFullYear(year, month - 1, day); parsed.setUTCHours(0, 0, 0, 0);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

export function createDashboardService(sqlite: DatabaseSync, options: Options = {}) {
  const now = options.now ?? Date.now;
  const diary = createDiaryService(sqlite, options);
  const numeric = (totals: Record<string, NutrientSummary>, id: string) => totals[id]?.amount ?? 0;
  const nullableFiber = (totals: Record<string, NutrientSummary>) => {
    const value = totals.fiber_g;
    return value && (value.amount !== 0 || value.coverage > 0) ? value.amount : null;
  };

  return {
    getDashboard(input: { userId: string; date: string }): Dashboard {
      if (!input?.userId || !validDate(input.date)) throw new DashboardError("DASHBOARD_INVALID_DATE");
      let day: ReturnType<typeof diary.getDay>;
      try { day = diary.getDay({ userId: input.userId, date: input.date }); } catch (error) {
        if (error instanceof Error && "code" in error) throw new DashboardError(String((error as DiaryError).code));
        throw error;
      }
      const goalRow = sqlite.prepare("SELECT g.calorie_target_kcal kcal,g.protein_target_g proteinG,g.fat_target_g fatG,g.carb_target_g carbG,g.fiber_target_g fiberG FROM diary_day d LEFT JOIN profile_nutrition_goal g ON g.id=d.goal_id AND g.user_id=d.user_id WHERE d.id=? AND d.user_id=?").get(day.id, input.userId) as { kcal: number | null; proteinG: number | null; fatG: number | null; carbG: number | null; fiberG: number | null } | undefined;
      const goal = goalRow?.kcal === null || goalRow?.kcal === undefined ? null : { kcal: goalRow.kcal, proteinG: goalRow.proteinG, fatG: goalRow.fatG, carbG: goalRow.carbG, fiberG: goalRow.fiberG };
      const totals = day.dailyTotal.nutrients as Record<string, NutrientSummary>;
      const intake = { kcal: numeric(totals, "energy_kcal"), proteinG: numeric(totals, "protein_g"), fatG: numeric(totals, "fat_g"), carbG: numeric(totals, "carbohydrate_g"), fiberG: nullableFiber(totals) };
      const coverage = Object.fromEntries(Object.entries(totals).map(([id, value]) => [id, { coverage: value.coverage, hasTrace: value.hasTrace, hasEstimated: value.hasEstimated }]));
      const meals = day.mealSlots.map((slot) => {
        const mealTotals = day.mealTotals[slot.key] as MealTotals | undefined;
        return { key: slot.key, displayName: slot.displayName, totals: { kcal: numeric(mealTotals?.nutrients ?? {}, "energy_kcal") } };
      });
      const remainingKcal = goal ? goal.kcal - intake.kcal : null;
      sqlite.prepare("INSERT INTO analytics_daily_summary (user_id,local_date,intake_kcal,exercise_kcal,protein_g,fat_g,carb_g,fiber_g,weight_kg,goal_kcal,computed_at,calc_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,local_date) DO UPDATE SET intake_kcal=excluded.intake_kcal,exercise_kcal=excluded.exercise_kcal,protein_g=excluded.protein_g,fat_g=excluded.fat_g,carb_g=excluded.carb_g,fiber_g=excluded.fiber_g,weight_kg=excluded.weight_kg,goal_kcal=excluded.goal_kcal,computed_at=excluded.computed_at,calc_version=excluded.calc_version").run(input.userId, input.date, intake.kcal, 0, intake.proteinG, intake.fatG, intake.carbG, intake.fiberG, null, goal?.kcal ?? null, now(), DASHBOARD_CALC_VERSION);
      return { date: input.date, goal, intake, coverage, exercise: { burnKcal: 0, creditKcal: 0, available: false }, remainingKcal, meals };
    },
  };
}
