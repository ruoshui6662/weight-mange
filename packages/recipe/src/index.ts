import type { NutrientStatus, NutrientSummary } from "@nutrition-tracker/nutrition-engine";

export const RECIPE_CALC_VERSION = "recipe_yield_v1" as const;

export type RecipeWarningCode =
  | "COOKED_WEIGHT_MISSING"
  | "SERVING_COUNT_MISSING"
  | "NUTRIENT_COVERAGE_INCOMPLETE"
  | "NUTRIENT_TRACE"
  | "NUTRIENT_ESTIMATED"
  | "NUTRIENT_UNKNOWN";

export type RecipeWarning = { code: RecipeWarningCode; nutrientId?: string; ingredientId?: string };

export type RecipeIngredientSnapshot = {
  ingredientId: string;
  gramEquivalent: number;
  nutrients: Record<string, {
    amountNumeric: number | null;
    valueStatus: NutrientStatus | "not_applicable";
    amountRaw: string | null;
  }>;
};

export type RecipeCalculationInput = {
  ingredients: readonly RecipeIngredientSnapshot[];
  cookedWeightG: number | null;
  servingCount: number | null;
};

export type RecipeCalculation = {
  calcVersion: typeof RECIPE_CALC_VERSION;
  total: Record<string, NutrientSummary>;
  per100g: Record<string, NutrientSummary> | null;
  perServing: Record<string, NutrientSummary> | null;
  warnings: RecipeWarning[];
};

export class RecipeError extends Error {
  constructor(readonly code: string, readonly details?: Record<string, unknown>) {
    super(code);
    this.name = "RecipeError";
  }
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function scaleSummary(summary: NutrientSummary, factor: number): NutrientSummary {
  return { amount: summary.amount * factor, coverage: summary.coverage, hasTrace: summary.hasTrace, hasEstimated: summary.hasEstimated };
}

export function calculateRecipe(input: RecipeCalculationInput): RecipeCalculation {
  if (!input || !Array.isArray(input.ingredients)) throw new RecipeError("RECIPE_INVALID_INPUT");
  if (input.cookedWeightG !== null && !finitePositive(input.cookedWeightG)) throw new RecipeError("RECIPE_INVALID_INPUT");
  if (input.servingCount !== null && !finitePositive(input.servingCount)) throw new RecipeError("RECIPE_INVALID_INPUT");

  const totals = new Map<string, { amount: number; relevantWeight: number; coveredWeight: number; hasTrace: boolean; hasEstimated: boolean }>();
  const warnings: RecipeWarning[] = [];
  for (const ingredient of input.ingredients) {
    if (!ingredient || typeof ingredient.ingredientId !== "string" || !finitePositive(ingredient.gramEquivalent) || !ingredient.nutrients || typeof ingredient.nutrients !== "object") {
      throw new RecipeError("RECIPE_INVALID_INPUT");
    }
    const nutrients = ingredient.nutrients as RecipeIngredientSnapshot["nutrients"];
    for (const [nutrientId, value] of Object.entries(nutrients)) {
      if (!value || !["known", "trace", "unknown", "not_applicable", "estimated"].includes(value.valueStatus)) throw new RecipeError("RECIPE_INVALID_INPUT");
      const current = totals.get(nutrientId) ?? { amount: 0, relevantWeight: 0, coveredWeight: 0, hasTrace: false, hasEstimated: false };
      current.relevantWeight += ingredient.gramEquivalent;
      if (value.valueStatus === "known" || value.valueStatus === "estimated") {
        if (!Number.isFinite(value.amountNumeric) || value.amountNumeric === null || value.amountNumeric < 0) throw new RecipeError("RECIPE_INVALID_INPUT");
        current.amount += value.amountNumeric;
      }
      if (value.valueStatus === "known") current.coveredWeight += ingredient.gramEquivalent;
      current.hasTrace ||= value.valueStatus === "trace";
      current.hasEstimated ||= value.valueStatus === "estimated";
      totals.set(nutrientId, current);
      if (value.valueStatus === "trace") warnings.push({ code: "NUTRIENT_TRACE", nutrientId, ingredientId: ingredient.ingredientId });
      if (value.valueStatus === "estimated") warnings.push({ code: "NUTRIENT_ESTIMATED", nutrientId, ingredientId: ingredient.ingredientId });
      if (value.valueStatus === "unknown") warnings.push({ code: "NUTRIENT_UNKNOWN", nutrientId, ingredientId: ingredient.ingredientId });
    }
  }

  const total: Record<string, NutrientSummary> = {};
  for (const [nutrientId, value] of totals) {
    const summary = { amount: value.amount, coverage: value.relevantWeight === 0 ? 1 : value.coveredWeight / value.relevantWeight, hasTrace: value.hasTrace, hasEstimated: value.hasEstimated };
    total[nutrientId] = summary;
    if (summary.coverage < 1) warnings.push({ code: "NUTRIENT_COVERAGE_INCOMPLETE", nutrientId });
  }

  const per100g = input.cookedWeightG === null ? null : Object.fromEntries(Object.entries(total).map(([nutrientId, summary]) => [nutrientId, scaleSummary(summary, 100 / input.cookedWeightG!)]));
  const perServing = input.servingCount === null ? null : Object.fromEntries(Object.entries(total).map(([nutrientId, summary]) => [nutrientId, scaleSummary(summary, 1 / input.servingCount!)]));
  if (input.cookedWeightG === null) warnings.unshift({ code: "COOKED_WEIGHT_MISSING" });
  if (input.servingCount === null) warnings.unshift({ code: "SERVING_COUNT_MISSING" });
  return { calcVersion: RECIPE_CALC_VERSION, total, per100g, perServing, warnings };
}
