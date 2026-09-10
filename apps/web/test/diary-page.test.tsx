import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DiaryPage } from "../src/ui/DiaryPage";

const dashboard = {
  date: "2026-09-10",
  goal: { kcal: 1800, proteinG: 120, fatG: 60, carbG: 210 },
  intake: { kcal: 255, proteinG: 18, fatG: 9, carbG: 34 },
  remainingKcal: 1545,
  meals: [
    { key: "breakfast", displayName: "早餐", totals: { kcal: 255 } },
    { key: "lunch", displayName: "午餐", totals: { kcal: 0 } },
    { key: "dinner", displayName: "晚餐", totals: { kcal: 0 } },
    { key: "snack", displayName: "加餐", totals: { kcal: 0 } },
  ],
};

const diary = {
  mealSlots: [
    { id: "u:breakfast", key: "breakfast", displayName: "早餐" },
    { id: "u:lunch", key: "lunch", displayName: "午餐" },
    { id: "u:dinner", key: "dinner", displayName: "晚餐" },
    { id: "u:snack", key: "snack", displayName: "加餐" },
  ],
  entries: [],
};

const props = {
  today: "2026-09-10",
  dashboard,
  diary,
  query: "",
  setQuery: vi.fn(),
  results: [{ id: "food-1", name: "燕麦", summary: { energyKcal: 389 } }],
  selected: "food-1",
  setSelected: vi.fn(),
  amount: "100",
  setAmount: vi.fn(),
  meal: "breakfast",
  setMeal: vi.fn(),
  busy: false,
  searchStatus: "success" as const,
  showImportGuide: false,
  setShowImportGuide: vi.fn(),
  onSearch: vi.fn(async (event: React.FormEvent) => event.preventDefault()),
  onAddEntry: vi.fn(async (event: React.FormEvent) => event.preventDefault()),
  mealEntries: new Map(),
  editingEntry: null,
  busyEntry: null,
  onEdit: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  onSave: vi.fn(async () => undefined),
  onCancelEdit: vi.fn(),
  onCopyDay: vi.fn(async () => undefined),
  onCopyMeal: vi.fn(async () => undefined),
};

describe("DiaryPage", () => {
  it("renders a desktop search-and-summary workspace with a selectable full-row result", () => {
    const html = renderToStaticMarkup(React.createElement(DiaryPage, props));
    expect(html).toContain('data-diary-layout="workspace"');
    expect(html).toContain("本地食物目录");
    expect(html).toContain('data-food-result="food-1"');
    expect(html).toContain('aria-label="选择燕麦"');
    expect(html).toContain("今日摘要");
  });

  it("exposes quantity controls, explicit meal selection and 44px hit areas", () => {
    const html = renderToStaticMarkup(React.createElement(DiaryPage, props));
    expect(html).toContain('aria-label="减少份量"');
    expect(html).toContain('aria-label="增加份量"');
    expect(html).toContain('aria-label="添加到餐次"');
    expect(html).toContain("加入饮食记录");
    expect(html.match(/data-hit-area="44"/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("explains the local-catalog empty state and keeps import guidance actionable", () => {
    const html = renderToStaticMarkup(React.createElement(DiaryPage, {
      ...props,
      results: [],
      selected: null,
      searchStatus: "empty",
    }));
    expect(html).toContain("没有找到匹配食物");
    expect(html).toContain("当前只搜索本地食物目录");
    expect(html).toContain("查看导入说明");
  });

  it("labels the mobile summary move and renders localized loading and error states", () => {
    const html = renderToStaticMarkup(React.createElement(DiaryPage, {
      ...props,
      searchStatus: "loading",
      searchError: "请求未完成，请稍后重试。",
    }));
    expect(html).toContain("移动端将在搜索后显示今日摘要");
    expect(html).toContain("正在搜索本地食物目录");
    expect(html).toContain("请求未完成，请稍后重试。");
  });
});
