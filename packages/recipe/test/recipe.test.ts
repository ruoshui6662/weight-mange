import { describe, expect, it } from "vitest";

import { calculateRecipe, RECIPE_CALC_VERSION } from "../src/index.js";

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
});
