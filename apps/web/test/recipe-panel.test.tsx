import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { addRecipeToDiaryAction, copyRecipeAction, createIngredientRowKey, deleteRecipeAction, RecipeFoodSearchStatus, RecipeListStatus, RecipePanel, recipeDraftFromRecipe, recipeErrorText, refreshRecipeAction, reloadRecipeAction, updateRecipeAction } from "../src/RecipePanel";
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

  it("keeps a deferred save pending until the server response resolves", async () => {
    let resolveUpdate!: (value: Recipe) => void;
    const pendingUpdate = new Promise<Recipe>((resolve) => { resolveUpdate = resolve; });
    const update = vi.fn(() => pendingUpdate);
    const save = updateRecipeAction({ ...client, updateRecipe: update }, recipe, {
      name: recipe.name,
      cookedWeightG: String(recipe.cookedWeightG),
      servingCount: String(recipe.servingCount),
      ingredients: [{ key: "ingredient-1", foodId: "food-1", name: "馒头", amount: "100" }],
    });

    let settled = false;
    void save.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);

    resolveUpdate({ ...recipe, version: 8 });
    await expect(save).resolves.toMatchObject({ version: 8 });
    expect(settled).toBe(true);
  });

  it("sends explicit nulls when clearing optional yield fields", async () => {
    const update = vi.fn(async () => ({ ...recipe, cookedWeightG: null, servingCount: null, version: 8 }));
    await updateRecipeAction({ ...client, updateRecipe: update }, recipe, { name: recipe.name, cookedWeightG: "", servingCount: "", ingredients: [{ key: "ingredient-1", foodId: "food-1", name: "馒头", amount: "100" }] });
    expect(update).toHaveBeenCalledWith("recipe-1", expect.objectContaining({ version: 7, cookedWeightG: null, servingCount: null }));
  });

  it("omits ingredients for metadata-only edits and preserves non-g input snapshots", async () => {
    const draft = recipeDraftFromRecipe({ ...recipe, ingredients: [{ ...recipe.ingredients[0], inputAmount: 2, inputUnit: "ml", gramEquivalent: 200 }] });
    const update = vi.fn(async () => recipe);
    await updateRecipeAction({ ...client, updateRecipe: update }, { ...recipe, ingredients: [{ ...recipe.ingredients[0], inputAmount: 2, inputUnit: "ml", gramEquivalent: 200 }] }, { ...draft, name: "改名" });
    expect(update).toHaveBeenCalledWith("recipe-1", expect.objectContaining({ name: "改名", version: 7 }));
    expect(update.mock.calls[0][1]).not.toHaveProperty("ingredients");

    const changedDraft = { ...draft, ingredients: [{ ...draft.ingredients[0], amount: "250" }] };
    await updateRecipeAction({ ...client, updateRecipe: update }, { ...recipe, ingredients: [{ ...recipe.ingredients[0], inputAmount: 2, inputUnit: "ml", gramEquivalent: 200 }] }, changedDraft);
    expect(update.mock.calls[1][1]).toMatchObject({ ingredients: [{ foodId: "food-1", amount: 250, unit: "g" }] });

    const mixedRecipe = { ...recipe, ingredients: [
      { ...recipe.ingredients[0], id: "ingredient-ml", inputAmount: 2, inputUnit: "ml" as const, gramEquivalent: 200 },
      { ...recipe.ingredients[0], id: "ingredient-g", inputAmount: 100, inputUnit: "g" as const, gramEquivalent: 100 },
    ] };
    const mixedDraft = recipeDraftFromRecipe(mixedRecipe);
    mixedDraft.ingredients[1].amount = "125";
    await updateRecipeAction({ ...client, updateRecipe: update }, mixedRecipe, mixedDraft);
    expect(update.mock.calls[2][1]).toMatchObject({ ingredients: [{ foodId: "food-1", amount: 2, unit: "ml" }, { foodId: "food-1", amount: 125, unit: "g" }] });
  });

  it("fetches fresh detail before opening and can recover the latest version after a conflict", async () => {
    const fresh = { ...recipe, version: 9, name: "服务端最新菜谱" };
    const getRecipe = vi.fn(async () => fresh);
    await expect(reloadRecipeAction({ ...client, getRecipe }, "recipe-1")).resolves.toEqual(fresh);
    expect(getRecipe).toHaveBeenCalledWith("recipe-1");
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
