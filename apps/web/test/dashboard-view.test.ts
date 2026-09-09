import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsPanel, DashboardView, FoodSearchCard, WeightPanel } from "../src/App";

const noopAsync = async () => undefined;

describe("dashboard interaction feedback", () => {
  it("renders all navigation actions with an observable current state", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardView, {
      today: "2026-09-10",
      dashboard: null,
      diary: null,
      profile: { id: "u1", displayName: "ruoshui", timezone: "Asia/Shanghai", body: null },
      loadDashboard: noopAsync,
      onLogout: noopAsync,
      error: "",
      setError: vi.fn(),
    }));
    expect(html).toContain('aria-label="主导航"');
    expect(html.match(/<button type="button"/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("今日");
    expect(html).toContain("饮食");
    expect(html).toContain("菜谱");
    expect(html).toContain("体重");
    expect(html).toContain("分析");
    expect(html).toContain("我的");
    expect(html).toContain('aria-current="page"');
  });

  it("renders a local-catalog empty state and import guidance", () => {
    const html = renderToStaticMarkup(React.createElement(FoodSearchCard, {
      query: "馒头",
      setQuery: vi.fn(),
      results: [],
      selected: null,
      setSelected: vi.fn(),
      amount: "100",
      setAmount: vi.fn(),
      meal: "breakfast",
      setMeal: vi.fn(),
      busy: false,
      searchStatus: "empty",
      showImportGuide: true,
      setShowImportGuide: vi.fn(),
      onSearch: noopAsync,
      onAddEntry: noopAsync,
    }));
    expect(html).toContain("没有找到匹配食物");
    expect(html).toContain("本地食物目录");
    expect(html).toContain("tools/food-import");
  });

  it("renders explicit empty and insufficient-data states for M2 panels", () => {
    const weightHtml = renderToStaticMarkup(React.createElement(WeightPanel, { records: [], trend: null, loading: false, error: "", onRetry: noopAsync, onAdd: noopAsync }));
    expect(weightHtml).toContain("暂无体重记录");
    expect(weightHtml).toContain("添加体重");
    const analyticsHtml = renderToStaticMarkup(React.createElement(AnalyticsPanel, { overview: null, tdee: { status: "insufficient_data", estimatedTdeeKcal: null, reason: "insufficient_data", confidence: 0 }, loading: false, error: "", onRetry: noopAsync }));
    expect(analyticsHtml).toContain("数据不足");
    expect(analyticsHtml).toContain("不会伪造估算");
  });

  it("renders actionable service error states for M2 panels", () => {
    const weightHtml = renderToStaticMarkup(React.createElement(WeightPanel, { records: [], trend: null, loading: false, error: "BODY_UNAVAILABLE", onRetry: noopAsync, onAdd: noopAsync }));
    const analyticsHtml = renderToStaticMarkup(React.createElement(AnalyticsPanel, { overview: null, tdee: null, loading: false, error: "ANALYTICS_UNAVAILABLE", onRetry: noopAsync }));
    expect(weightHtml).toContain("体重服务暂时不可用");
    expect(weightHtml).toContain("重试");
    expect(analyticsHtml).toContain("分析服务暂时不可用");
    expect(analyticsHtml).toContain("重试");
  });

  it("renders record edit, delete, and copy actions for an existing diary entry", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardView, {
      today: "2026-09-10",
      dashboard: { date: "2026-09-10", goal: { kcal: 1800, proteinG: null, fatG: null, carbG: null }, intake: { kcal: 223, proteinG: 7, fatG: 1, carbG: 47 }, remainingKcal: 1577, meals: [{ key: "breakfast", displayName: "早餐", totals: { kcal: 223 } }] },
      diary: { mealSlots: [{ id: "u:breakfast", key: "breakfast", displayName: "早餐" }], entries: [{ id: "entry-1", mealSlotId: "u:breakfast", displayNameSnapshot: "馒头", amount: 100, unit: "g", version: 0 }] },
      profile: { id: "u1", displayName: "ruoshui", timezone: "Asia/Shanghai", body: null },
      loadDashboard: noopAsync,
      onLogout: noopAsync,
      error: "",
      setError: vi.fn(),
    }));
    expect(html).toContain("编辑");
    expect(html).toContain("删除");
    expect(html).toContain("复制昨日早餐");
  });
});
