import type { RecipeNutrientSummary, RecipeWarning } from "./api";

export type RecipeDraftIngredient = { key: string; foodId: string; name: string; amount: string };
export type RecipeDraft = { name: string; cookedWeightG: string; servingCount: string; ingredients: RecipeDraftIngredient[] };
export type RecipeFormError =
  | "NAME_REQUIRED"
  | "INGREDIENT_REQUIRED"
  | "INGREDIENT_FOOD_REQUIRED"
  | "INGREDIENT_AMOUNT_INVALID"
  | "COOKED_WEIGHT_INVALID"
  | "SERVING_COUNT_INVALID";

const positiveNumber = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0;
};

export function validateRecipeDraft(draft: RecipeDraft): RecipeFormError | null {
  if (!draft.name.trim()) return "NAME_REQUIRED";
  if (draft.ingredients.length === 0) return "INGREDIENT_REQUIRED";
  for (const ingredient of draft.ingredients) {
    if (!ingredient.foodId.trim()) return "INGREDIENT_FOOD_REQUIRED";
    if (!positiveNumber(ingredient.amount)) return "INGREDIENT_AMOUNT_INVALID";
  }
  if (draft.cookedWeightG.trim() && !positiveNumber(draft.cookedWeightG)) return "COOKED_WEIGHT_INVALID";
  if (draft.servingCount.trim() && !positiveNumber(draft.servingCount)) return "SERVING_COUNT_INVALID";
  return null;
}

const warningMessages: Record<RecipeWarning["code"], string> = {
  COOKED_WEIGHT_MISSING: "未填写成品重量，无法展示每100克营养。",
  SERVING_COUNT_MISSING: "未填写份数，无法展示每份营养。",
  NUTRIENT_COVERAGE_INCOMPLETE: "部分营养数据覆盖不完整。",
  NUTRIENT_TRACE: "部分营养值为微量值。",
  NUTRIENT_ESTIMATED: "部分营养值为估算值。",
  NUTRIENT_UNKNOWN: "部分营养值未知。",
  RECIPE_INGREDIENT_REFRESH_UNAVAILABLE: "部分原料暂时无法刷新，已保留原有快照。",
};

export function warningText(warning: RecipeWarning): string {
  const text = warningMessages[warning.code] ?? "菜谱存在数据提示。";
  return warning.ingredientId ? `${text}（原料 ${warning.ingredientId}）` : text;
}

export function nutrientValue(summary: RecipeNutrientSummary | null | undefined): string {
  return summary && Number.isFinite(summary.amount) ? String(summary.amount) : "—";
}
