import { describe, expect, it } from "vitest";

import {
  NUTRITION_ENGINE_VERSION,
  convertPortionToGrams,
  roundForDisplay,
  scaleNutrients,
  sumNutrients,
  type NutrientInput,
} from "../src/index.js";

describe("nutrition engine", () => {
  it("locks the foundation algorithm versions", () => {
    expect(NUTRITION_ENGINE_VERSION).toBe(1);
  });

  it("scales per-100g nutrients without intermediate display rounding", () => {
    const result = scaleNutrients({
      per100g: { energy_kcal: { status: "known", value: 223 } },
      amountGrams: 75,
    });

    expect(result.nutrients.energy_kcal).toMatchObject({ amount: 167.25, coverage: 1 });
    expect(roundForDisplay("energy_kcal", result.nutrients.energy_kcal.amount)).toBe(167);
  });

  it("converts a volume only when density is supplied", () => {
    expect(convertPortionToGrams({ amount: 5, unit: "ml", densityGramsPerMl: 0.91 })).toBe(4.55);
    expect(() => convertPortionToGrams({ amount: 5, unit: "ml" })).toThrow(/density/i);
  });

  it("converts gram and serving portions including edible gross weight", () => {
    expect(convertPortionToGrams({ amount: 75, unit: "g" })).toBe(75);
    expect(convertPortionToGrams({ amount: 2, unit: "serving", gramsPerServing: 75 })).toBe(150);
    expect(convertPortionToGrams({ amount: 500, unit: "g", edibleRatio: 0.63 })).toBe(315);
    expect(() => convertPortionToGrams({ amount: 1, unit: "serving" })).toThrow(/gramsPerServing/i);
    expect(() => convertPortionToGrams({ amount: 10, unit: "g", edibleRatio: 1.1 })).toThrow(/edibleRatio/i);
  });

  it("sums known and estimated values while retaining trace and unknown coverage", () => {
    const inputs: NutrientInput[] = [
      { amountGrams: 100, nutrients: { iron_mg: { status: "known", value: 8.42 } } },
      { amountGrams: 50, nutrients: { iron_mg: { status: "unknown" } } },
      { amountGrams: 25, nutrients: { iron_mg: { status: "trace" } } },
      { amountGrams: 25, nutrients: { iron_mg: { status: "estimated", value: 2 } } },
    ];

    expect(sumNutrients(inputs).nutrients.iron_mg).toEqual({
      amount: 10.42,
      coverage: 0.625,
      hasTrace: true,
      hasEstimated: true,
    });
  });

  it("rounds macro and micro nutrients only for display", () => {
    expect(roundForDisplay("protein_g", 12.34)).toBe(12.3);
    expect(roundForDisplay("iron_mg", 8.426)).toBe(8.43);
    expect(roundForDisplay("sodium_mg", 120.54)).toBe(120.5);
    expect(roundForDisplay("body_weight_kg", 70.55)).toBe(70.6);
  });
});
