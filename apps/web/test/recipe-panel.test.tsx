import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { addRecipeToDiaryAction, copyRecipeAction, createIngredientRowKey, deleteRecipeAction, RecipeFoodSearchStatus, RecipeListStatus, RecipePanel, recipeErrorText, refreshRecipeAction, updateRecipeAction } from "../src/RecipePanel";
import { ApiError, type Recipe, type RecipeClient } from "../src/api";

const client = {
  getRecipes: vi.fn(async () => []),
  getRecipe: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  copyRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  refreshRecipeIngredients: vi.fn(),
  addRecipeToDiary: vi.fn(),
  searchFoods: vi.fn(async () => []),
} satisfies RecipeClient;

const recipe: Recipe = {
  id: "recipe-1", userId: "user-1", name: "馒头菜谱", cookedWeightG: 200, servingCount: 2, note: null,
  version: 7, deletedAt: null, createdAt: 1, updatedAt: 2,
  ingredients: [{ id: "ingredient-1", foodId: "food-1", servingId: null, nameSnapshot: "馒头", inputAmount: 100, inputUnit: "g", gramEquivalent: 100, sortOrder: 0, sourceSnapshot: null, nutrients: [] }],
  total: {}, per100g: {}, perServing: {}, warnings: [], calcVersion: "calc-1",
};

describe("RecipePanel", () => {
  it("uses a deterministic key when randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    try {
      vi.stubGlobal("crypto", { randomUUID: undefined });
      expect(createIngredientRowKey()).toBe("ingredient-row-1");
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });

  it("shows completion feedback when a food search returns no matches", () => {
    const html = renderToStaticMarkup(React.createElement(RecipeFoodSearchStatus, { searched: true, resultCount: 0 }));
    expect(html).toContain("没有找到匹配原料");
  });

  it("sends the current version and preserves the draft when an update conflicts", async () => {
    const draft = { name: "新名字", cookedWeightG: "220", servingCount: "2", ingredients: [{ key: "ingredient-1", foodId: "food-1", name: "馒头", amount: "120" }] };
    const update = vi.fn(async () => { throw new ApiError("RECIPE_VERSION_CONFLICT", 409); });
    const injected = { ...client, updateRecipe: update } satisfies RecipeClient;
    await expect(updateRecipeAction(injected, recipe, draft)).rejects.toMatchObject({ code: "RECIPE_VERSION_CONFLICT" });
    expect(update).toHaveBeenCalledWith("recipe-1", expect.objectContaining({ version: 7, name: "新名字", cookedWeightG: 220, servingCount: 2, ingredients: [{ foodId: "food-1", amount: 120, unit: "g" }] }));
    expect(draft.name).toBe("新名字");
    expect(recipeErrorText(new ApiError("RECIPE_VERSION_CONFLICT", 409))).toContain("重新加载");
  });

  it("uses copy and refresh responses, and delete only after confirmation", async () => {
    const copied = { ...recipe, id: "recipe-copy", name: "复制菜谱" };
    const refreshed = { ...recipe, version: 8, warnings: [{ code: "NUTRIENT_ESTIMATED" as const }] };
    const injected = { ...client, copyRecipe: vi.fn(async () => copied), refreshRecipeIngredients: vi.fn(async () => refreshed), deleteRecipe: vi.fn(async () => ({ ok: true })) } satisfies RecipeClient;
    await expect(copyRecipeAction(injected, recipe.id)).resolves.toEqual(copied);
    await expect(refreshRecipeAction(injected, recipe)).resolves.toEqual(refreshed);
    await expect(deleteRecipeAction(injected, recipe, () => false)).resolves.toBe(false);
    expect(injected.deleteRecipe).not.toHaveBeenCalled();
    await expect(deleteRecipeAction(injected, recipe, () => true)).resolves.toBe(true);
    expect(injected.deleteRecipe).toHaveBeenCalledWith("recipe-1");
    expect(recipeErrorText(new ApiError("RECIPE_NOT_FOUND", 404))).toContain("返回菜谱列表");
  });

  it("reloads diary before opening diary after adding a recipe", async () => {
    const order: string[] = [];
    const injected = { ...client, addRecipeToDiary: vi.fn(async () => { order.push("add"); return {}; }) } satisfies RecipeClient;
    await addRecipeToDiaryAction(injected, "recipe-1", { date: "2026-09-10", mealSlotId: "breakfast", amount: 100, unit: "g" }, async () => { order.push("reload"); }, () => { order.push("open"); });
    expect(injected.addRecipeToDiary).toHaveBeenCalledWith("recipe-1", { date: "2026-09-10", mealSlotId: "breakfast", amount: 100, unit: "g" });
    expect(order).toEqual(["add", "reload", "open"]);
  });
  it("shows loading state before the recipe list is available", () => {
    const html = renderToStaticMarkup(React.createElement(RecipePanel, {
      today: "2026-09-10",
      client,
      onDiaryReload: async () => undefined,
      onOpenDiary: vi.fn(),
    }));

    expect(html).toContain("正在加载菜谱");
    expect(html).toContain("菜谱");
  });

  it("keeps stable accessible actions in the initial editor contract", () => {
    const html = renderToStaticMarkup(React.createElement(RecipePanel, {
      today: "2026-09-10",
      client,
      onDiaryReload: async () => undefined,
      onOpenDiary: vi.fn(),
    }));

    expect(html).toContain("新建菜谱");
  });

  it("keeps existing recipes visible when a reload fails", () => {
    const html = renderToStaticMarkup(React.createElement(RecipeListStatus, {
      loading: false,
      error: "服务暂时不可用",
      hasRecipes: true,
      onRetry: vi.fn(),
    }));

    expect(html).toContain("服务暂时不可用");
    expect(html).toContain("重试");
    expect(html).not.toContain("还没有菜谱");
  });
});
