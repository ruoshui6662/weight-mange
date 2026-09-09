import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { convertPortionToGrams, NUTRITION_ENGINE_VERSION, type NutrientStatus, type NutrientSummary } from "@nutrition-tracker/nutrition-engine";

export const RECIPE_CALC_VERSION = "recipe_yield_v1" as const;

export type RecipeWarningCode =
  | "COOKED_WEIGHT_MISSING"
  | "SERVING_COUNT_MISSING"
  | "NUTRIENT_COVERAGE_INCOMPLETE"
  | "NUTRIENT_TRACE"
  | "NUTRIENT_ESTIMATED"
  | "NUTRIENT_UNKNOWN"
  | "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE";
export type RecipeWarning = { code: RecipeWarningCode; nutrientId?: string; ingredientId?: string };

export type RecipeIngredientSnapshot = { ingredientId: string; gramEquivalent: number; nutrients: Record<string, { amountNumeric: number | null; valueStatus: NutrientStatus | "not_applicable"; amountRaw: string | null }> };
export type RecipeCalculationInput = { ingredients: readonly RecipeIngredientSnapshot[]; cookedWeightG: number | null; servingCount: number | null };
export type RecipeCalculation = { calcVersion: typeof RECIPE_CALC_VERSION; total: Record<string, NutrientSummary>; per100g: Record<string, NutrientSummary> | null; perServing: Record<string, NutrientSummary> | null; warnings: RecipeWarning[] };

export type RecipeUnit = "g" | "ml" | "serving";
export type RecipeIngredientInput = { foodId: string; amount: number; unit: RecipeUnit; servingId?: string | null };
export type RecipeCreateInput = { userId: string; name: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients: readonly RecipeIngredientInput[] };
export type RecipeUpdateInput = { userId: string; recipeId: string; version: number; name?: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients?: readonly RecipeIngredientInput[] };
export type RecipeGetInput = { userId: string; recipeId: string };
export type RecipeListInput = { userId: string };
export type RecipeCopyInput = { userId: string; recipeId: string; name?: string };
export type RecipeRefreshInput = { userId: string; recipeId: string; ingredientIds?: readonly string[] };
export type RecipeAddToDiaryInput = { userId: string; recipeId: string; date: string; mealSlotId: string; amount: number; unit: "g"; note?: string | null };

export type RecipeIngredient = {
  id: string; foodId: string | null; servingId: string | null; nameSnapshot: string; inputAmount: number; inputUnit: RecipeUnit; gramEquivalent: number | null; sortOrder: number;
  sourceSnapshot: Record<string, unknown> | null;
  nutrients: Array<{ id: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: NutrientStatus | "not_applicable"; sourceBasisJson: string; nutritionEngineVersion: string }>;
};
export type Recipe = {
  id: string; userId: string; name: string; cookedWeightG: number | null; servingCount: number | null; note: string | null; version: number; deletedAt: number | null; createdAt: number; updatedAt: number;
  ingredients: RecipeIngredient[]; total: Record<string, NutrientSummary>; per100g: Record<string, NutrientSummary> | null; perServing: Record<string, NutrientSummary> | null; warnings: RecipeWarning[]; calcVersion: typeof RECIPE_CALC_VERSION;
};

type Options = { now?: () => number; id?: () => string; diary?: DiarySnapshotWriter };
type DiarySnapshotWriter = { createRecipeSnapshotEntry(input: { userId: string; date: string; mealSlotId: string; recipeId: string; recipeName: string; amount: number; unit: "g"; gramEquivalent: number; sourceSnapshot: string; nutrients: Array<{ nutrientId: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: string; sourceBasisJson: string }>; note?: string | null }): { id: string; recipeId: string | null; [key: string]: unknown } };
type RecipeRow = { id: string; userId: string; name: string; cookedWeightG: number | null; servingCount: number | null; note: string | null; version: number; deletedAt: number | null; createdAt: number; updatedAt: number };
type IngredientRow = { id: string; recipeId: string; foodId: string | null; servingId: string | null; nameSnapshot: string; inputAmount: number; inputUnit: RecipeUnit; gramEquivalent: number | null; sortOrder: number };
type FoodResolution = { foodId: string; servingId: string | null; name: string; sourceSnapshot: Record<string, unknown>; gramEquivalent: number; snapshots: Array<{ id: string; nutrientId: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: NutrientStatus | "not_applicable"; sourceBasisJson: string }> };

export class RecipeError extends Error {
  constructor(readonly code: string, readonly details?: Record<string, unknown>) { super(code); this.name = "RecipeError"; }
}

function finitePositive(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function validUnit(value: unknown): value is RecipeUnit { return value === "g" || value === "ml" || value === "serving"; }
function scaleSummary(summary: NutrientSummary, factor: number): NutrientSummary { return { amount: summary.amount * factor, coverage: summary.coverage, hasTrace: summary.hasTrace, hasEstimated: summary.hasEstimated }; }

export function calculateRecipe(input: RecipeCalculationInput): RecipeCalculation {
  if (!input || !Array.isArray(input.ingredients)) throw new RecipeError("RECIPE_INVALID_INPUT");
  if (input.cookedWeightG !== null && !finitePositive(input.cookedWeightG)) throw new RecipeError("RECIPE_INVALID_INPUT");
  if (input.servingCount !== null && !finitePositive(input.servingCount)) throw new RecipeError("RECIPE_INVALID_INPUT");
  const totals = new Map<string, { amount: number; relevantWeight: number; coveredWeight: number; hasTrace: boolean; hasEstimated: boolean }>();
  const warnings: RecipeWarning[] = [];
  for (const ingredient of input.ingredients) {
    if (!ingredient || typeof ingredient.ingredientId !== "string" || !finitePositive(ingredient.gramEquivalent) || !ingredient.nutrients || typeof ingredient.nutrients !== "object") throw new RecipeError("RECIPE_INVALID_INPUT");
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

function jsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try { const parsed: unknown = JSON.parse(value); return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; } catch { return null; }
}

export function createRecipeService(sqlite: DatabaseSync, options: Options = {}) {
  const now = options.now ?? Date.now; const id = options.id ?? randomUUID;
  const readRecipe = (userId: string, recipeId: string, includeDeleted = false): RecipeRow | null => {
    const row = sqlite.prepare("SELECT id,user_id userId,name,cooked_weight_g cookedWeightG,serving_count servingCount,note,version,deleted_at deletedAt,created_at createdAt,updated_at updatedAt FROM recipe WHERE id=? AND user_id=? AND (?=1 OR deleted_at IS NULL)").get(recipeId, userId, includeDeleted ? 1 : 0) as RecipeRow | undefined;
    return row ?? null;
  };

  const resolveIngredient = (input: RecipeIngredientInput): FoodResolution => {
    if (!input || !input.foodId || !finitePositive(input.amount) || !validUnit(input.unit)) throw new RecipeError("RECIPE_INVALID_INPUT");
    const food = sqlite.prepare("SELECT fi.id,fi.primary_name name,fi.density_g_ml density,fi.edible_ratio edibleRatio,sr.id sourceId,sr.source_type source,fd.version datasetVersion FROM food_item fi JOIN food_source_record sr ON sr.food_id=fi.id AND sr.is_primary=1 LEFT JOIN food_dataset fd ON fd.id=sr.dataset_id WHERE fi.id=? AND fi.active=1").get(input.foodId) as { id: string; name: string; density: number | null; edibleRatio: number | null; sourceId: string; source: string; datasetVersion: string | null } | undefined;
    if (!food) throw new RecipeError("RECIPE_FOOD_NOT_FOUND", { foodId: input.foodId });
    let serving: { id: string; label: string; equivalentG: number | null } | undefined;
    if (input.unit === "serving") {
      serving = (input.servingId ? sqlite.prepare("SELECT id,label,equivalent_g equivalentG FROM food_serving WHERE id=? AND food_id=?").get(input.servingId, input.foodId) : sqlite.prepare("SELECT id,label,equivalent_g equivalentG FROM food_serving WHERE food_id=? AND is_default=1 ORDER BY sort_order,id LIMIT 1").get(input.foodId)) as typeof serving;
      if (!serving || !finitePositive(serving.equivalentG)) throw new RecipeError("RECIPE_SERVING_NOT_FOUND", { foodId: input.foodId, servingId: input.servingId ?? null });
    }
    let grams: number;
    try { grams = convertPortionToGrams({ amount: input.amount, unit: input.unit, ...(food.density === null ? {} : { densityGramsPerMl: food.density }), ...(serving?.equivalentG === null || serving?.equivalentG === undefined ? {} : { gramsPerServing: serving.equivalentG }), ...(food.edibleRatio === null ? {} : { edibleRatio: food.edibleRatio }) }); } catch { throw new RecipeError("RECIPE_PORTION_UNSUPPORTED"); }
    if (!finitePositive(grams)) throw new RecipeError("RECIPE_PORTION_UNSUPPORTED");
    const nutrientRows = sqlite.prepare("SELECT nv.nutrient_id nutrientId,nv.amount_numeric amountNumeric,nv.amount_raw amountRaw,nv.value_status valueStatus,nv.basis_amount basisAmount,nv.basis_unit basisUnit FROM food_nutrient_value nv WHERE nv.food_id=? AND nv.source_record_id=? ORDER BY nv.nutrient_id").all(input.foodId, food.sourceId) as Array<{ nutrientId: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: NutrientStatus | "not_applicable"; basisAmount: number; basisUnit: string }>;
    if (nutrientRows.some((row) => row.basisUnit !== "g" || !finitePositive(row.basisAmount))) throw new RecipeError("RECIPE_NUTRIENT_BASIS_UNSUPPORTED");
    const sourceSnapshot = { foodId: food.id, sourceRecordId: food.sourceId, source: food.source, datasetVersion: food.datasetVersion, servingId: serving?.id ?? null, inputAmount: input.amount, inputUnit: input.unit, gramEquivalent: grams, nutritionEngineVersion: NUTRITION_ENGINE_VERSION };
    return { foodId: food.id, servingId: serving?.id ?? null, name: food.name, sourceSnapshot, gramEquivalent: grams, snapshots: nutrientRows.map((row) => ({ id: id(), nutrientId: row.nutrientId, amountNumeric: row.valueStatus === "known" || row.valueStatus === "estimated" ? (row.amountNumeric === null ? null : row.amountNumeric * grams / row.basisAmount) : null, amountRaw: row.valueStatus === "known" || row.valueStatus === "estimated" ? (row.amountNumeric === null ? row.amountRaw : String(row.amountNumeric * grams / row.basisAmount)) : row.amountRaw, valueStatus: row.valueStatus, sourceBasisJson: JSON.stringify({ ...sourceSnapshot, sourceBasis: { amount: row.basisAmount, unit: row.basisUnit } }) })) };
  };

  const writeIngredients = (recipeId: string, ingredients: readonly RecipeIngredientInput[]) => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) throw new RecipeError("RECIPE_INVALID_INPUT");
    ingredients.forEach((input, sortOrder) => {
      const resolved = resolveIngredient(input); const ingredientId = id();
      sqlite.prepare("INSERT INTO recipe_ingredient (id,recipe_id,food_id,serving_id,name_snapshot,input_amount,input_unit,gram_equivalent,sort_order) VALUES (?,?,?,?,?,?,?,?,?)").run(ingredientId, recipeId, resolved.foodId, resolved.servingId, resolved.name, input.amount, input.unit, resolved.gramEquivalent, sortOrder);
      for (const snapshot of resolved.snapshots) sqlite.prepare("INSERT INTO recipe_ingredient_nutrient_snapshot (id,ingredient_id,nutrient_id,amount_numeric,amount_raw,value_status,source_basis_json,nutrition_engine_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(snapshot.id, ingredientId, snapshot.nutrientId, snapshot.amountNumeric, snapshot.amountRaw, snapshot.valueStatus, snapshot.sourceBasisJson, String(NUTRITION_ENGINE_VERSION), now());
    });
  };
  const invalidate = (recipeId: string, timestamp: number) => sqlite.prepare("UPDATE recipe_nutrient_cache SET invalidated_at=? WHERE recipe_id=?").run(timestamp, recipeId);

  const hydrate = (userId: string, recipeId: string, extraWarnings: RecipeWarning[] = []): Recipe => {
    const row = readRecipe(userId, recipeId, true); if (!row) throw new RecipeError("RECIPE_NOT_FOUND");
    const ingredientRows = sqlite.prepare("SELECT id,recipe_id recipeId,food_id foodId,serving_id servingId,name_snapshot nameSnapshot,input_amount inputAmount,input_unit inputUnit,gram_equivalent gramEquivalent,sort_order sortOrder FROM recipe_ingredient WHERE recipe_id=? ORDER BY sort_order,id").all(recipeId) as IngredientRow[];
    const ingredients: RecipeIngredient[] = ingredientRows.map((ingredient) => { const nutrients = sqlite.prepare("SELECT nutrient_id id,amount_numeric amountNumeric,amount_raw amountRaw,value_status valueStatus,source_basis_json sourceBasisJson,nutrition_engine_version nutritionEngineVersion FROM recipe_ingredient_nutrient_snapshot WHERE ingredient_id=? ORDER BY nutrient_id").all(ingredient.id) as RecipeIngredient["nutrients"]; return { ...ingredient, sourceSnapshot: jsonObject(nutrients[0]?.sourceBasisJson ?? null), nutrients }; });
    const calculation = calculateRecipe({ ingredients: ingredients.filter((ingredient): ingredient is RecipeIngredient & { gramEquivalent: number } => ingredient.gramEquivalent !== null).map((ingredient) => ({ ingredientId: ingredient.id, gramEquivalent: ingredient.gramEquivalent, nutrients: Object.fromEntries(ingredient.nutrients.map((nutrient) => [nutrient.id, { amountNumeric: nutrient.amountNumeric, amountRaw: nutrient.amountRaw, valueStatus: nutrient.valueStatus }])) })), cookedWeightG: row.cookedWeightG, servingCount: row.servingCount });
    sqlite.prepare("DELETE FROM recipe_nutrient_cache WHERE recipe_id=?").run(recipeId);
    for (const [nutrientId, summary] of Object.entries(calculation.total)) sqlite.prepare("INSERT INTO recipe_nutrient_cache (recipe_id,nutrient_id,total_amount,per_100g_amount,per_serving_amount,computed_at,calc_version,invalidated_at) VALUES (?,?,?,?,?,?,?,NULL)").run(recipeId, nutrientId, summary.amount, calculation.per100g?.[nutrientId]?.amount ?? null, calculation.perServing?.[nutrientId]?.amount ?? null, now(), RECIPE_CALC_VERSION);
    return { ...row, ingredients, total: calculation.total, per100g: calculation.per100g, perServing: calculation.perServing, warnings: [...calculation.warnings, ...extraWarnings], calcVersion: calculation.calcVersion };
  };

  const create = (input: RecipeCreateInput): Recipe => {
    if (!input || !input.userId || typeof input.name !== "string" || !input.name.trim() || (input.cookedWeightG !== undefined && input.cookedWeightG !== null && !finitePositive(input.cookedWeightG)) || (input.servingCount !== undefined && input.servingCount !== null && !finitePositive(input.servingCount))) throw new RecipeError("RECIPE_INVALID_INPUT");
    const recipeId = id(); const timestamp = now(); sqlite.exec("BEGIN IMMEDIATE");
    try { sqlite.prepare("INSERT INTO recipe (id,user_id,name,cooked_weight_g,serving_count,note,version,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)").run(recipeId, input.userId, input.name.trim(), input.cookedWeightG ?? null, input.servingCount ?? null, input.note ?? null, timestamp, timestamp); writeIngredients(recipeId, input.ingredients); sqlite.exec("COMMIT"); return hydrate(input.userId, recipeId); } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  };
  const get = (input: RecipeGetInput): Recipe | null => readRecipe(input.userId, input.recipeId) ? hydrate(input.userId, input.recipeId) : null;
  const list = (input: RecipeListInput): Recipe[] => (sqlite.prepare("SELECT id FROM recipe WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC").all(input.userId) as Array<{ id: string }>).map((row) => hydrate(input.userId, row.id));

  const update = (input: RecipeUpdateInput): Recipe => {
    if (!input || !input.userId || !input.recipeId || !Number.isInteger(input.version) || input.version < 0 || (input.name !== undefined && (typeof input.name !== "string" || !input.name.trim())) || (input.cookedWeightG !== undefined && input.cookedWeightG !== null && !finitePositive(input.cookedWeightG)) || (input.servingCount !== undefined && input.servingCount !== null && !finitePositive(input.servingCount)) || (input.ingredients !== undefined && (!Array.isArray(input.ingredients) || input.ingredients.length === 0))) throw new RecipeError("RECIPE_INVALID_INPUT");
    const current = readRecipe(input.userId, input.recipeId); if (!current) throw new RecipeError("RECIPE_NOT_FOUND"); if (current.version !== input.version) throw new RecipeError("RECIPE_VERSION_CONFLICT");
    const timestamp = now(); sqlite.exec("BEGIN IMMEDIATE");
    try { sqlite.prepare("UPDATE recipe SET name=COALESCE(?,name),cooked_weight_g=COALESCE(?,cooked_weight_g),serving_count=COALESCE(?,serving_count),note=COALESCE(?,note),version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?").run(input.name?.trim() ?? null, input.cookedWeightG ?? null, input.servingCount ?? null, input.note ?? null, timestamp, input.recipeId, input.userId, input.version); if (input.ingredients !== undefined) { sqlite.prepare("DELETE FROM recipe_ingredient WHERE recipe_id=?").run(input.recipeId); writeIngredients(input.recipeId, input.ingredients); } invalidate(input.recipeId, timestamp); sqlite.exec("COMMIT"); return hydrate(input.userId, input.recipeId); } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  };

  const copy = (input: RecipeCopyInput): Recipe => {
    const source = readRecipe(input.userId, input.recipeId); if (!source) throw new RecipeError("RECIPE_NOT_FOUND");
    const newId = id(); const timestamp = now(); sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.prepare("INSERT INTO recipe (id,user_id,name,cooked_weight_g,serving_count,note,version,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)").run(newId, input.userId, input.name?.trim() || `${source.name}（副本）`, source.cookedWeightG, source.servingCount, source.note, timestamp, timestamp);
      const oldIngredients = sqlite.prepare("SELECT id,food_id foodId,serving_id servingId,name_snapshot nameSnapshot,input_amount inputAmount,input_unit inputUnit,gram_equivalent gramEquivalent,sort_order sortOrder FROM recipe_ingredient WHERE recipe_id=? ORDER BY sort_order,id").all(input.recipeId) as IngredientRow[];
      for (const old of oldIngredients) { const newIngredientId = id(); sqlite.prepare("INSERT INTO recipe_ingredient (id,recipe_id,food_id,serving_id,name_snapshot,input_amount,input_unit,gram_equivalent,sort_order) VALUES (?,?,?,?,?,?,?,?,?)").run(newIngredientId, newId, old.foodId, old.servingId, old.nameSnapshot, old.inputAmount, old.inputUnit, old.gramEquivalent, old.sortOrder); const snapshots = sqlite.prepare("SELECT nutrient_id nutrientId,amount_numeric amountNumeric,amount_raw amountRaw,value_status valueStatus,source_basis_json sourceBasisJson,nutrition_engine_version nutritionEngineVersion FROM recipe_ingredient_nutrient_snapshot WHERE ingredient_id=?").all(old.id) as Array<{ nutrientId: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: string; sourceBasisJson: string; nutritionEngineVersion: string }>; for (const snapshot of snapshots) sqlite.prepare("INSERT INTO recipe_ingredient_nutrient_snapshot (id,ingredient_id,nutrient_id,amount_numeric,amount_raw,value_status,source_basis_json,nutrition_engine_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id(), newIngredientId, snapshot.nutrientId, snapshot.amountNumeric, snapshot.amountRaw, snapshot.valueStatus, snapshot.sourceBasisJson, snapshot.nutritionEngineVersion, timestamp); }
      sqlite.exec("COMMIT"); return hydrate(input.userId, newId);
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  };

  const remove = (input: RecipeGetInput) => { const timestamp = now(); const result = sqlite.prepare("UPDATE recipe SET deleted_at=?,updated_at=?,version=version+1 WHERE id=? AND user_id=? AND deleted_at IS NULL").run(timestamp, timestamp, input.recipeId, input.userId); if (result.changes !== 1) throw new RecipeError("RECIPE_NOT_FOUND"); };

  const refreshIngredients = (input: RecipeRefreshInput): Recipe => {
    const current = readRecipe(input.userId, input.recipeId); if (!current) throw new RecipeError("RECIPE_NOT_FOUND");
    const ids = input.ingredientIds ? [...input.ingredientIds] : (sqlite.prepare("SELECT id FROM recipe_ingredient WHERE recipe_id=? ORDER BY sort_order,id").all(input.recipeId) as Array<{ id: string }>).map((row) => row.id);
    const available = new Set((sqlite.prepare("SELECT id FROM recipe_ingredient WHERE recipe_id=?").all(input.recipeId) as Array<{ id: string }>).map((row) => row.id)); if (ids.some((ingredientId) => !available.has(ingredientId))) throw new RecipeError("RECIPE_INGREDIENT_NOT_FOUND");
    const warnings: RecipeWarning[] = []; const timestamp = now(); sqlite.exec("BEGIN IMMEDIATE");
    try {
      for (const ingredientId of ids) {
        const ingredient = sqlite.prepare("SELECT id,recipe_id recipeId,food_id foodId,serving_id servingId,name_snapshot nameSnapshot,input_amount inputAmount,input_unit inputUnit,gram_equivalent gramEquivalent,sort_order sortOrder FROM recipe_ingredient WHERE id=? AND recipe_id=?").get(ingredientId, input.recipeId) as IngredientRow;
        if (!ingredient.foodId) { warnings.push({ code: "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE", ingredientId }); continue; }
        try { const resolved = resolveIngredient({ foodId: ingredient.foodId, amount: ingredient.inputAmount, unit: ingredient.inputUnit, servingId: ingredient.servingId }); sqlite.prepare("DELETE FROM recipe_ingredient_nutrient_snapshot WHERE ingredient_id=?").run(ingredient.id); sqlite.prepare("UPDATE recipe_ingredient SET food_id=?,serving_id=?,name_snapshot=?,gram_equivalent=? WHERE id=?").run(resolved.foodId, resolved.servingId, resolved.name, resolved.gramEquivalent, ingredient.id); for (const snapshot of resolved.snapshots) sqlite.prepare("INSERT INTO recipe_ingredient_nutrient_snapshot (id,ingredient_id,nutrient_id,amount_numeric,amount_raw,value_status,source_basis_json,nutrition_engine_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(snapshot.id, ingredient.id, snapshot.nutrientId, snapshot.amountNumeric, snapshot.amountRaw, snapshot.valueStatus, snapshot.sourceBasisJson, String(NUTRITION_ENGINE_VERSION), timestamp); } catch (error) { if (error instanceof RecipeError && ["RECIPE_FOOD_NOT_FOUND", "RECIPE_SERVING_NOT_FOUND", "RECIPE_PORTION_UNSUPPORTED", "RECIPE_NUTRIENT_BASIS_UNSUPPORTED"].includes(error.code)) warnings.push({ code: "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE", ingredientId }); else throw error; }
      }
      sqlite.prepare("UPDATE recipe SET version=version+1,updated_at=? WHERE id=? AND user_id=?").run(timestamp, input.recipeId, input.userId); invalidate(input.recipeId, timestamp); sqlite.exec("COMMIT"); return hydrate(input.userId, input.recipeId, warnings);
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  };

  const addToDiary = (input: RecipeAddToDiaryInput) => {
    if (!options.diary) throw new RecipeError("RECIPE_DIARY_UNAVAILABLE");
    if (!input || !input.userId || !input.recipeId || !input.date || !input.mealSlotId || !finitePositive(input.amount) || input.unit !== "g") throw new RecipeError("RECIPE_INVALID_INPUT");
    const recipe = get({ userId: input.userId, recipeId: input.recipeId });
    if (!recipe) throw new RecipeError("RECIPE_NOT_FOUND");
    if (!recipe.per100g) throw new RecipeError("RECIPE_COOKED_WEIGHT_REQUIRED");
    const nutrients = Object.entries(recipe.per100g).map(([nutrientId, summary]) => {
      const valueStatus = summary.hasTrace ? "trace" : summary.hasEstimated ? "estimated" : summary.coverage < 1 ? "unknown" : "known";
      const amountNumeric = valueStatus === "known" || valueStatus === "estimated" ? summary.amount * input.amount / 100 : null;
      return { nutrientId, amountNumeric, amountRaw: amountNumeric === null ? (valueStatus === "trace" ? "Tr" : "—") : String(amountNumeric), valueStatus, sourceBasisJson: JSON.stringify({ recipeId: recipe.id, calcVersion: recipe.calcVersion, ingredientIds: recipe.ingredients.map((ingredient) => ingredient.id), per100g: true, amountGrams: input.amount }) };
    });
    return options.diary.createRecipeSnapshotEntry({ userId: input.userId, date: input.date, mealSlotId: input.mealSlotId, recipeId: recipe.id, recipeName: recipe.name, amount: input.amount, unit: "g", gramEquivalent: input.amount, sourceSnapshot: JSON.stringify({ recipeId: recipe.id, calcVersion: recipe.calcVersion, ingredientIds: recipe.ingredients.map((ingredient) => ingredient.id), amountGrams: input.amount }), nutrients, ...(input.note === undefined ? {} : { note: input.note }) });
  };

  return { create, get, list, update, copy, delete: remove, refreshIngredients, addToDiary };
}
