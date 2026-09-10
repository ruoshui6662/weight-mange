import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "../src/ui/AnalyticsPage";

const overview = {
  period: { from: "2026-08-12", to: "2026-09-10", days: 30 },
  recordCoverage: { recordedDays: 18, totalDays: 30, ratio: 0.6 },
  averages: { intakeKcal: 1820, proteinG: 92, fatG: 61, carbG: 210 },
  goal: { days: 18, averageKcal: 1800, averageDifferenceKcal: 20 },
  weight: { observedDays: 12, startKg: 70.2, endKg: 69.4, deltaKg: -0.8 },
};

const tdee = {
  methodVersion: "adaptive-tdee-v1",
  status: "estimated" as const,
  reason: null,
  rawTdeeKcal: 2110,
  estimatedTdeeKcal: 2087,
  confidence: 0.78,
  recommendedCalorieTargetKcal: null,
  period: { from: "2026-08-12", to: "2026-09-10" },
};

describe("AnalyticsPage", () => {
  it("separates observed facts, coverage, and server estimate without a goal mutation action", () => {
    const html = renderToStaticMarkup(<AnalyticsPage overview={overview} tdee={tdee} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="" onRetry={vi.fn()} />);
    expect(html).toContain("事实数据");
    expect(html).toContain("记录覆盖");
    expect(html).toContain("60%");
    expect(html).toContain("服务端估算");
    expect(html).toContain("2,087 kcal");
    expect(html).toContain("只读");
    expect(html).toContain('data-analytics-trend="weight"');
    expect(html).toContain("体重趋势");
    expect(html).toContain("30 天");
    expect(html).not.toContain("更新目标");
    expect(html).not.toContain("设置为每日目标");
  });

  it("exposes the supported period control and selected window", () => {
    const html = renderToStaticMarkup(<AnalyticsPage overview={overview} tdee={null} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="" onRetry={vi.fn()} />);
    expect(html).toContain('aria-label="分析周期"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("7 天");
    expect(html).toContain("30 天");
    expect(html).toContain("90 天");
  });

  it("keeps insufficient data explicit and does not turn missing values into zero", () => {
    const html = renderToStaticMarkup(<AnalyticsPage overview={{ ...overview, averages: { intakeKcal: null, proteinG: null, fatG: null, carbG: null }, goal: { days: 0, averageKcal: null, averageDifferenceKcal: null }, weight: { observedDays: 0, startKg: null, endKg: null, deltaKg: null }, recordCoverage: { recordedDays: 0, totalDays: 30, ratio: 0 } }} tdee={{ ...tdee, status: "insufficient_data", estimatedTdeeKcal: null }} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="" onRetry={vi.fn()} />);
    expect(html).toContain("数据不足");
    expect(html).toContain("不会伪造估算");
    expect(html).toContain("未记录");
    expect(html).not.toMatch(/>0 kcal</);
  });

  it("separates throttled service state from insufficient data", () => {
    const html = renderToStaticMarkup(<AnalyticsPage overview={overview} tdee={{ ...tdee, status: "throttled", estimatedTdeeKcal: null, reason: "throttled" }} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="" onRetry={vi.fn()} />);
    expect(html).toContain("服务暂时不可用");
    expect(html).toContain("重试");
    expect(html).not.toContain("当前周期暂不能生成 Adaptive TDEE");
  });

  it("shows an explicit trend empty state when no observed endpoints exist", () => {
    const html = renderToStaticMarkup(<AnalyticsPage overview={{ ...overview, weight: { observedDays: 0, startKg: null, endKg: null, deltaKg: null } }} tdee={null} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="" onRetry={vi.fn()} />);
    expect(html).toContain("体重趋势数据不足");
    expect(html).toContain("不会用零值填充");
  });

  it("renders localized loading and error states", () => {
    const loading = renderToStaticMarkup(<AnalyticsPage overview={null} tdee={null} periodDays={30} onPeriodChange={vi.fn()} loading error="" onRetry={vi.fn()} />);
    const error = renderToStaticMarkup(<AnalyticsPage overview={null} tdee={null} periodDays={30} onPeriodChange={vi.fn()} loading={false} error="ANALYTICS_UNAVAILABLE" onRetry={vi.fn()} />);
    expect(loading).toContain("正在加载分析");
    expect(error).toContain("分析服务暂时不可用");
    expect(error).toContain("重试");
  });
});
