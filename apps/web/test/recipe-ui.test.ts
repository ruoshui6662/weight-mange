import { describe, expect, it } from "vitest";
import { nutrientValue, validateRecipeDraft, warningText, type RecipeDraft } from "../src/recipe-ui";

const validIngredient = { key: "i-1", foodId: "food-1", name: "馒头", amount: "100" };
const validDraft = (overrides: Partial<RecipeDraft> = {}): RecipeDraft => ({
  name: "早餐菜谱",
  cookedWeightG: "200",
  servingCount: "2",
  ingredients: [validIngredient],
  ...overrides,
});

describe("recipe UI helpers", () => {
  it("rejects an empty recipe name", async () => {
    const { validateRecipeDraft } = await import("../src/recipe-ui");
    expect(validateRecipeDraft(validDraft({ name: "  " }))).toBe("NAME_REQUIRED");
  });

  it("rejects a recipe without ingredients", () => {
    expect(validateRecipeDraft(validDraft({ ingredients: [] }))).toBe("INGREDIENT_REQUIRED");
  });

  it("rejects an ingredient without a selected food", () => {
    expect(validateRecipeDraft(validDraft({ ingredients: [{ ...validIngredient, foodId: "" }] }))).toBe("INGREDIENT_FOOD_REQUIRED");
  });

  it.each(["0", "-1", "nope", "Infinity", ""]) ("rejects invalid ingredient amount %s", (amount) => {
    expect(validateRecipeDraft(validDraft({ ingredients: [{ ...validIngredient, amount }] }))).toBe("INGREDIENT_AMOUNT_INVALID");
  });

  it("accepts a valid draft and optional numeric fields", () => {
    expect(validateRecipeDraft(validDraft({ cookedWeightG: "", servingCount: "" }))).toBeNull();
    expect(validateRecipeDraft(validDraft())).toBeNull();
  });

  it.each([
    ["cookedWeightG", "0"],
    ["cookedWeightG", "-1"],
    ["cookedWeightG", "abc"],
    ["servingCount", "0"],
    ["servingCount", "-1"],
    ["servingCount", "abc"],
  ] as const)("rejects invalid %s", (field, value) => {
    expect(validateRecipeDraft(validDraft({ [field]: value }))).toBe(field === "cookedWeightG" ? "COOKED_WEIGHT_INVALID" : "SERVING_COUNT_INVALID");
  });

  it("maps every server warning and includes ingredient context", () => {
    const codes = [
      "COOKED_WEIGHT_MISSING",
      "SERVING_COUNT_MISSING",
      "NUTRIENT_COVERAGE_INCOMPLETE",
      "NUTRIENT_TRACE",
      "NUTRIENT_ESTIMATED",
      "NUTRIENT_UNKNOWN",
      "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE",
    ] as const;
    for (const code of codes) {
      expect(warningText({ code })).toMatch(/.+/);
      expect(warningText({ code, ingredientId: "ingredient-7" })).toContain("ingredient-7");
    }
  });

  it("does not invent a nutrient value for missing or non-finite summaries", () => {
    expect(nutrientValue(null)).toBe("—");
    expect(nutrientValue(undefined)).toBe("—");
    expect(nutrientValue({ amount: 12.5, coverage: 1, hasTrace: false, hasEstimated: false })).toBe("12.5");
    expect(nutrientValue({ amount: Number.NaN, coverage: 1, hasTrace: false, hasEstimated: false })).toBe("—");
  });
});
