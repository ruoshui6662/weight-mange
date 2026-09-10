import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TodayPage } from "../src/ui/TodayPage";

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
  entries: [{ id: "entry-1", mealSlotId: "u:breakfast", displayNameSnapshot: "燕麦", amount: 100, unit: "g", version: 0 }],
};

const props = {
  today: "2026-09-10",
  dashboard,
  diary,
  profile: { id: "u1", displayName: "ruoshui", timezone: "Asia/Shanghai", body: null },
  onAddFood: <button type="button">记录饮食</button>,
  onCopyDay: vi.fn(async () => undefined),
  onCopyMeal: vi.fn(async () => undefined),
  onEdit: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  onSave: vi.fn(async () => undefined),
  onCancelEdit: vi.fn(),
  mealEntries: new Map(),
  editingEntry: null,
  busyEntry: null,
};

describe("TodayPage", () => {
  it("answers remaining calories with a readable hero and macro semantics", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html).toContain("还可以吃");
    expect(html).toContain("1545 kcal");
    expect(html).toContain("已摄入");
    expect(html).toContain("目标");
    expect(html).toContain("蛋白质");
    expect(html).toContain("脂肪");
    expect(html).toContain("碳水");
    expect(html).toContain("coral");
    expect(html).toContain("sunflower");
    expect(html).toContain("mint");
  });

  it("renders the four meal groups and an independent quick-record rail", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html).toContain("早餐");
    expect(html).toContain("午餐");
    expect(html).toContain("晚餐");
    expect(html).toContain("加餐");
    expect(html).toContain("快速记录");
    expect(html).toContain("记录饮食");
    expect(html).toContain("本周概览");
    expect(html).toContain('data-today-layout="dashboard"');
  });

  it("keeps missing data explicit instead of silently showing zero", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, { ...props, dashboard: null, diary: null }));
    expect(html).toContain("今日数据暂不可用");
    expect(html).toContain("先记录一餐");
    expect(html).not.toContain("0 kcal");
  });

  it("keeps the meal-slot selector and 44px hit-area contract while editing", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      editingEntry: { id: "entry-1", displayName: "燕麦", amount: 100, unit: "g", mealSlotId: "breakfast", version: 0 },
    }));
    expect(html).toContain('aria-label="编辑餐次-燕麦"');
    expect(html).toContain('value="breakfast"');
    expect(html).toContain("午餐");
    expect(html.match(/data-hit-area="44"/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
