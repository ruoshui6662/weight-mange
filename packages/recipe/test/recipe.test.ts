import { describe, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS, ANALYTICS_MIGRATIONS, BODY_MIGRATIONS, RECIPE_MIGRATIONS } from "../../db/src/schema.js";
import { createFoodCatalog } from "../../food/src/index.js";
import { createDiaryService } from "../../diary/src/index.js";

import { calculateRecipe, createRecipeService, RECIPE_CALC_VERSION } from "../src/index.js";

function setup() {
  const { sqlite } = openDatabase(":memory:");
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS, ...BODY_MIGRATIONS, ...RECIPE_MIGRATIONS]);
  sqlite.prepare("INSERT INTO profile_user (id,display_name,timezone,created_at,updated_at) VALUES ('user-1','User','Asia/Shanghai',1,1)").run();
  const foods = createFoodCatalog(sqlite, { now: () => 10, id: (() => { let i = 0; return () => `food-${++i}`; })() });
  const food = foods.createCustom({ name: "豆浆", nutrients: { energyKcal: 30, proteinG: 2, fatG: 1, carbG: 3 }, servings: [{ label: "一杯", amount: 250, unit: "g", equivalentG: 250 }] });
  const diary = createDiaryService(sqlite, { now: () => 200, id: (() => { let i = 0; return () => `diary-${++i}`; })() });
  const recipes = createRecipeService(sqlite, { now: () => 100, id: (() => { let i = 0; return () => `recipe-${++i}`; })(), diary });
  return { sqlite, foods, foodId: food.id, servingId: foods.detail(food.id)?.servings[0]?.id as string, recipes, diary };
}

describe("recipe package baseline", () => {
  it("exports the fixed recipe calculation version", () => {
    expect(RECIPE_CALC_VERSION).toBe("recipe_yield_v1");
  });

  it("calculates total, per-100g, per-serving, coverage, and warnings", () => {
    const result = calculateRecipe({
      ingredients: [
        { ingredientId: "egg", gramEquivalent: 200, nutrients: {
          energy_kcal: { amountNumeric: 500, valueStatus: "known", amountRaw: "500" },
          protein_g: { amountNumeric: 40, valueStatus: "known", amountRaw: "40" },
        } },
        { ingredientId: "oil", gramEquivalent: 50, nutrients: {
          energy_kcal: { amountNumeric: 500, valueStatus: "estimated", amountRaw: "500" },
        } },
      ],
      cookedWeightG: 500,
      servingCount: 2,
    });

    expect(result.calcVersion).toBe("recipe_yield_v1");
    expect(result.total.energy_kcal).toMatchObject({ amount: 1000, coverage: 0.8, hasEstimated: true });
    expect(result.per100g?.energy_kcal).toMatchObject({ amount: 200, coverage: 0.8, hasEstimated: true });
    expect(result.perServing?.energy_kcal).toMatchObject({ amount: 500, coverage: 0.8, hasEstimated: true });
    expect(result.total.protein_g).toMatchObject({ amount: 40, coverage: 1, hasEstimated: false });
    expect(result.warnings).toEqual(expect.arrayContaining([
      { code: "NUTRIENT_ESTIMATED", nutrientId: "energy_kcal", ingredientId: "oil" },
      { code: "NUTRIENT_COVERAGE_INCOMPLETE", nutrientId: "energy_kcal" },
    ]));
  });

  it("keeps trace and unknown statuses visible and warns when yield denominators are absent", () => {
    const result = calculateRecipe({
      ingredients: [
        { ingredientId: "salt", gramEquivalent: 10, nutrients: {
          sodium_mg: { amountNumeric: null, valueStatus: "trace", amountRaw: "Tr" },
        } },
        { ingredientId: "spice", gramEquivalent: 20, nutrients: {
          sodium_mg: { amountNumeric: null, valueStatus: "unknown", amountRaw: "—" },
        } },
      ],
      cookedWeightG: null,
      servingCount: null,
    });

    expect(result.per100g).toBeNull();
    expect(result.perServing).toBeNull();
    expect(result.total.sodium_mg).toMatchObject({ amount: 0, coverage: 0, hasTrace: true, hasEstimated: false });
    expect(result.warnings).toEqual(expect.arrayContaining([
      { code: "COOKED_WEIGHT_MISSING" },
      { code: "SERVING_COUNT_MISSING" },
      { code: "NUTRIENT_TRACE", nutrientId: "sodium_mg", ingredientId: "salt" },
      { code: "NUTRIENT_UNKNOWN", nutrientId: "sodium_mg", ingredientId: "spice" },
    ]));
  });

  it("rejects non-positive cooked weights and serving counts", () => {
    const input = { ingredients: [], cookedWeightG: 0, servingCount: 1 };
    expect(() => calculateRecipe(input)).toThrow("RECIPE_INVALID_INPUT");
    expect(() => calculateRecipe({ ...input, cookedWeightG: 1, servingCount: 0 })).toThrow("RECIPE_INVALID_INPUT");
  });

  it("creates immutable ingredient snapshots and rebuilds the derived cache", () => {
    const { sqlite, foodId, recipes } = setup();
    const created = recipes.create({ userId: "user-1", name: "早餐豆浆", cookedWeightG: 200, servingCount: 2, ingredients: [{ foodId, amount: 100, unit: "g" }] });
    expect(created).toMatchObject({ name: "早餐豆浆", version: 1, calcVersion: "recipe_yield_v1" });
    expect(created.total.energy_kcal).toMatchObject({ amount: 30, coverage: 1 });
    expect(created.per100g?.energy_kcal.amount).toBe(15);
    expect(created.perServing?.energy_kcal.amount).toBe(15);
    expect(created.ingredients[0]).toMatchObject({ nameSnapshot: "豆浆", inputAmount: 100, inputUnit: "g", gramEquivalent: 100 });
    expect(sqlite.prepare("SELECT count(*) count FROM recipe_ingredient_nutrient_snapshot s JOIN recipe_ingredient i ON i.id=s.ingredient_id WHERE i.recipe_id=?").get(created.id)).toEqual({ count: 4 });
    expect(sqlite.prepare("SELECT invalidated_at FROM recipe_nutrient_cache WHERE recipe_id=? AND nutrient_id='energy_kcal'").get(created.id)).toEqual({ invalidated_at: null });
    sqlite.close();
  });

  it("does not change an old recipe when food nutrients are revised", () => {
    const { sqlite, foods, foodId, recipes } = setup();
    const old = recipes.create({ userId: "user-1", name: "旧配方", ingredients: [{ foodId, amount: 100, unit: "g" }] });
    foods.update(foodId, { nutrients: { energyKcal: 99 } });
    const fresh = recipes.create({ userId: "user-1", name: "新配方", ingredients: [{ foodId, amount: 100, unit: "g" }] });
    expect(recipes.get({ userId: "user-1", recipeId: old.id })?.total.energy_kcal.amount).toBe(30);
    expect(fresh.total.energy_kcal.amount).toBe(99);
    sqlite.close();
  });

  it("refreshes selected ingredients explicitly and preserves an unavailable snapshot", () => {
    const { sqlite, foods, foodId, recipes } = setup();
    const created = recipes.create({ userId: "user-1", name: "可刷新", ingredients: [{ foodId, amount: 100, unit: "g" }] });
    const ingredientId = created.ingredients[0]!.id;
    foods.update(foodId, { nutrients: { energyKcal: 88 } });
    const refreshed = recipes.refreshIngredients({ userId: "user-1", recipeId: created.id, ingredientIds: [ingredientId] });
    expect(refreshed.total.energy_kcal.amount).toBe(88);
    sqlite.prepare("UPDATE food_item SET active=0 WHERE id=?").run(foodId);
    const unavailable = recipes.refreshIngredients({ userId: "user-1", recipeId: created.id, ingredientIds: [ingredientId] });
    expect(unavailable.total.energy_kcal.amount).toBe(88);
    expect(unavailable.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE", ingredientId })]));
    sqlite.close();
  });

  it("enforces optimistic versions, copies snapshots, and soft deletes", () => {
    const { sqlite, foodId, recipes } = setup();
    const created = recipes.create({ userId: "user-1", name: "可编辑", ingredients: [{ foodId, amount: 100, unit: "g" }] });
    expect(() => recipes.update({ userId: "user-1", recipeId: created.id, version: 0, name: "冲突" })).toThrow("RECIPE_VERSION_CONFLICT");
    const updated = recipes.update({ userId: "user-1", recipeId: created.id, version: created.version, name: "已编辑" });
    expect(updated.name).toBe("已编辑");
    const copy = recipes.copy({ userId: "user-1", recipeId: updated.id, name: "副本" });
    expect(copy.id).not.toBe(updated.id);
    expect(copy.ingredients[0]?.id).not.toBe(updated.ingredients[0]?.id);
    recipes.delete({ userId: "user-1", recipeId: updated.id });
    expect(recipes.get({ userId: "user-1", recipeId: updated.id })).toBeNull();
    expect(recipes.get({ userId: "user-1", recipeId: copy.id })).not.toBeNull();
    sqlite.close();
  });

  it("clears optional yield fields when update explicitly sends null", () => {
    const { sqlite, foodId, recipes } = setup();
    const created = recipes.create({ userId: "user-1", name: "可清除", cookedWeightG: 200, servingCount: 2, ingredients: [{ foodId, amount: 100, unit: "g" }] });

    const cleared = recipes.update({ userId: "user-1", recipeId: created.id, version: created.version, cookedWeightG: null, servingCount: null });

    expect(cleared).toMatchObject({ cookedWeightG: null, servingCount: null, version: 2 });
    expect(cleared.per100g).toBeNull();
    expect(cleared.perServing).toBeNull();
    expect(cleared.warnings).toEqual(expect.arrayContaining([{ code: "COOKED_WEIGHT_MISSING" }, { code: "SERVING_COUNT_MISSING" }]));
    sqlite.close();
  });

  it("leaves optional yield fields unchanged when update omits them", () => {
    const { sqlite, foodId, recipes } = setup();
    const created = recipes.create({ userId: "user-1", name: "可保留", cookedWeightG: 200, servingCount: 2, ingredients: [{ foodId, amount: 100, unit: "g" }] });

    const updated = recipes.update({ userId: "user-1", recipeId: created.id, version: created.version, name: "名称更新" });

    expect(updated).toMatchObject({ name: "名称更新", cookedWeightG: 200, servingCount: 2, version: 2 });
    expect(updated.per100g).not.toBeNull();
    expect(updated.perServing).not.toBeNull();
    sqlite.close();
  });

  it("adds a recipe portion to diary using a fresh nutrition snapshot", () => {
    const { sqlite, foodId, recipes, diary } = setup();
    const created = recipes.create({ userId: "user-1", name: "日记菜谱", cookedWeightG: 200, ingredients: [{ foodId, amount: 100, unit: "g" }] });
    const entry = recipes.addToDiary({ userId: "user-1", recipeId: created.id, date: "2026-09-09", mealSlotId: "dinner", amount: 165, unit: "g" });
    expect(entry).toMatchObject({ recipeId: created.id, displayNameSnapshot: "日记菜谱", amount: 165 });
    expect(entry.nutrients.find((nutrient) => nutrient.nutrientId === "energy_kcal")?.amountNumeric).toBeCloseTo(24.75);
    foodsUpdate(sqlite, foodId, 999);
    expect(diary.getDay({ userId: "user-1", date: "2026-09-09" }).dailyTotal.nutrients.energy_kcal.amount).toBeCloseTo(24.75);
    sqlite.close();
  });
});

function foodsUpdate(sqlite: ReturnType<typeof openDatabase>["sqlite"], foodId: string, amount: number) {
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=? WHERE food_id=? AND nutrient_id='energy_kcal'").run(amount, foodId);
}
