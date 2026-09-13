import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  onCopyDay: vi.fn(async () => undefined),
  onStartMealAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  onSave: vi.fn(async () => undefined),
  onCancelEdit: vi.fn(),
  mealEntries: new Map(),
  editingEntry: null,
  busyEntry: null,
};

const recentWeightRecords = [
  { id: "w1", measuredAt: "2026-09-09T00:00:00.000Z", localDate: "2026-09-09", weightKg: 62.7, source: "manual", note: null, version: 0 },
  { id: "w2", measuredAt: "2026-09-10T00:00:00.000Z", localDate: "2026-09-10", weightKg: 62.3, source: "manual", note: null, version: 0 },
];
const recentWeightTrend = {
  methodVersion: "weight_trend_v1",
  windowDays: 7,
  method: "ewma",
  alpha: 0.25,
  observedDays: 2,
  points: [
    { localDate: "2026-09-09", weightKg: 62.7, trendWeightKg: 62.7 },
    { localDate: "2026-09-10", weightKg: 62.3, trendWeightKg: 62.3 },
  ],
};

describe("TodayPage", () => {
  it("shows zero intake and the full remaining budget on an unmarked day", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      dashboard: { ...dashboard, intake: { kcal: 0, proteinG: 0, fatG: 0, carbG: 0 }, remainingKcal: 1800, meals: dashboard.meals.map((meal) => ({ ...meal, totals: { kcal: 0 } })) },
      diary: { ...diary, entries: [] },
    }));
    expect(html).toContain("今日热量");
    expect(html).toContain("已摄入 <b>0 kcal</b>");
    expect(html).toContain("还可以吃");
    expect(html).toContain("1800 kcal");
    expect(html).toContain("已完成 0%");
    expect(html).toContain('style="--today-progress:0%"');
  });

  it("shows a recent weight trend card when the last week has records", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      weightRecords: recentWeightRecords,
      weightTrend: recentWeightTrend,
    }));
    expect(html).toContain('data-today-weight-trend="visible"');
    expect(html).toContain("体重趋势");
    expect(html).toContain("62.3 kg");
    expect(html).toContain("↓ 0.4 kg");
    expect(html).toContain('data-trend-point="2026-09-10"');
  });

  it("does not render a weight trend card without recent records", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      weightRecords: [],
      weightTrend: recentWeightTrend,
    }));
    expect(html).not.toContain("data-today-weight-trend");
    expect(html).not.toContain("体重趋势");
  });

  it("hides the trend when records exist only before the seven-day window", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      weightRecords: [{ ...recentWeightRecords[0], localDate: "2026-09-02", measuredAt: "2026-09-02T00:00:00.000Z" }],
      weightTrend: recentWeightTrend,
    }));
    expect(html).not.toContain('data-today-weight-trend="visible"');
  });

  it("clamps the remaining display at zero and explains an over-budget day", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      dashboard: { ...dashboard, intake: { ...dashboard.intake, kcal: 2000 }, remainingKcal: -200 },
    }));
    expect(html).toContain("还可以吃");
    expect(html).toContain("0 kcal");
    expect(html).toContain("已超出预算 200 kcal");
    expect(html).not.toContain("-200 kcal");
  });

  it("answers remaining calories with a readable hero and macro semantics", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html).toContain('data-calorie-summary="combined"');
    expect(html).toContain('data-macro-layout="inline"');
    expect(html).not.toContain('class="today-macro-overview"');
    expect(html).toContain("还可以吃");
    expect(html).toContain("1545 kcal");
    expect(html).toContain('style="--today-progress:14%"');
    expect(html).toContain("已摄入");
    expect(html).toContain("目标");
    expect(html).toContain("蛋白质");
    expect(html).toContain("脂肪");
    expect(html).toContain("碳水");
    expect(html).toContain("coral");
    expect(html).toContain("sunflower");
    expect(html).toContain("mint");
  });

  it("keeps all three macro metrics in one compact responsive row", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html.match(/class="today-macro-item /g)?.length).toBe(3);
    expect(html).toContain("18 / 120 g");
    expect(html).toContain("9 / 60 g");
    expect(html).toContain("34 / 210 g");
  });

  it("keeps the macro strip at three columns across the narrow breakpoint", () => {
    const styles = readFileSync(resolve(process.cwd(), "apps/web/src/styles.css"), "utf8");
    expect(styles).toContain(".today-macro-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).toContain("@container (max-width: 560px)");
    expect(styles).not.toContain(".today-macro-overview, .today-meal-grid");
  });

  it("renders the four meal groups without a duplicate quick-record rail", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html).toContain("早餐");
    expect(html).toContain("午餐");
    expect(html).toContain("晚餐");
    expect(html).toContain("加餐");
    expect(html).toContain("数据说明");
    expect(html).not.toContain("快速记录");
    expect(html).not.toContain("前往记录区");
    expect(html).toContain("本周概览");
    expect(html).toContain('data-today-layout="dashboard"');
  });

  it("keeps whole-day copy but removes per-meal yesterday copy actions", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, props));
    expect(html).toContain("复制昨日整天");
    expect(html).not.toContain("复制昨日早餐");
    expect(html).not.toContain("复制昨日午餐");
    expect(html).not.toContain("复制昨日晚餐");
    expect(html).not.toContain("复制昨日加餐");
  });

  it("renders four meal add buttons as the only food-record entry point", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, { ...props, diary: { ...diary, entries: [] } }));
    expect(html).toContain("今日饮食记录");
    expect(html).not.toContain("记录饮食");
    expect(html).toContain('data-meal-add="breakfast"');
    expect(html).toContain('data-meal-add="lunch"');
    expect(html).toContain('data-meal-add="dinner"');
    expect(html).toContain('data-meal-add="snack"');
    expect(html).toContain('data-today-empty-state="visible"');
  });

  it("guides an empty meal from its add button instead of an absent lower panel", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, { ...props, diary: { ...diary, entries: [] } }));
    expect(html).toContain("点击对应餐次的“添加”按钮开始记录");
    expect(html).not.toContain("从下方快速添加一项");
  });

  it("removes the empty state once any meal has a diary entry", () => {
    const html = renderToStaticMarkup(React.createElement(TodayPage, { ...props, diary: { ...diary, entries: [] } }));
    const filled = renderToStaticMarkup(React.createElement(TodayPage, {
      ...props,
      diary: { ...diary, entries: [...diary.entries, { id: "entry-2", mealSlotId: "u:lunch", displayNameSnapshot: "鸡蛋", amount: 50, unit: "g", version: 0 }] },
    }));
    expect(html).toContain('data-today-empty-state="visible"');
    expect(filled).not.toContain('data-today-empty-state="visible"');
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
