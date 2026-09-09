import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecipePanel } from "../src/RecipePanel";
import type { RecipeClient } from "../src/api";

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

describe("RecipePanel", () => {
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
});
