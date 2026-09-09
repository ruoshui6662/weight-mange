import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardView, FoodSearchCard } from "../src/App";

const noopAsync = async () => undefined;

describe("dashboard interaction feedback", () => {
  it("renders all navigation actions with an observable current state", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardView, {
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
});
