import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WeightRecord, WeightTrend } from "../src/api";
import { buildManualWeightInput, persistWeightRecord, weightSaveErrorMessage, weightSaveSuccessMessage, WeightPage } from "../src/ui/WeightPage";

const noopAsync = async () => undefined;

const baseProps = {
  records: [] as WeightRecord[],
  trend: null as WeightTrend | null,
  loading: false,
  error: "",
  onRetry: noopAsync,
  onAdd: noopAsync,
};

describe("WeightPage", () => {
  it("submits the selected calendar date without converting it through browser timezone", () => {
    expect(buildManualWeightInput("2026-09-10", 68.4, "晨起")).toEqual({ localDate: "2026-09-10", weightKg: 68.4, note: "晨起" });
    expect(buildManualWeightInput("2026-09-10", 68.4, "  ")).toEqual({ localDate: "2026-09-10", weightKg: 68.4 });
  });

  it("explains insufficient data without manufacturing zero points", () => {
    const html = renderToStaticMarkup(<WeightPage {...baseProps} />);

    expect(html).toContain("数据不足");
    expect(html).toContain("尚无足够记录");
    expect(html).toContain("记录体重");
    expect(html).not.toContain("0 kg");
    expect(html).not.toContain("data-trend-point");
  });

  it("renders observed kg values and trend dates only when supplied", () => {
    const record: WeightRecord = { id: "w1", measuredAt: "2026-09-10T00:00:00.000Z", localDate: "2026-09-10", weightKg: 68.4, source: "manual", note: null, version: 0 };
    const trend: WeightTrend = { methodVersion: "ewma-v1", windowDays: 7, method: "ewma", alpha: 0.3, observedDays: 1, points: [{ localDate: "2026-09-10", weightKg: 68.4, trendWeightKg: 68.4 }] };
    const html = renderToStaticMarkup(<WeightPage {...baseProps} records={[record]} trend={trend} />);

    expect(html).toContain("68.4 kg");
    expect(html).toContain("2026-09-10");
    expect(html).toContain("7 天趋势");
    expect(html).toContain("记录体重");
    expect(html).toContain("data-trend-point=\"2026-09-10\"");
  });

  it("keeps loading and error states actionable", () => {
    const loadingHtml = renderToStaticMarkup(<WeightPage {...baseProps} loading />);
    const errorHtml = renderToStaticMarkup(<WeightPage {...baseProps} error="BODY_UNAVAILABLE" onRetry={vi.fn(noopAsync)} />);

    expect(loadingHtml).toContain("正在加载体重趋势");
    expect(errorHtml).toContain("体重服务暂时不可用");
    expect(errorHtml).toContain("重试");
  });

  it("propagates failed saves so the page can keep form values and show recovery copy", async () => {
    const onAdd = vi.fn(async () => { throw new Error("service unavailable"); });

    await expect(persistWeightRecord(onAdd, { localDate: "2026-09-10", weightKg: 68.4, note: "晨起" })).rejects.toThrow("service unavailable");
    expect(onAdd).toHaveBeenCalledWith({ localDate: "2026-09-10", weightKg: 68.4, note: "晨起" });
    expect(weightSaveErrorMessage).toContain("保存未完成");
    expect(weightSaveErrorMessage).toContain("输入内容已保留");
  });

  it("exposes explicit success feedback copy after a successful save path", async () => {
    const onAdd = vi.fn(async () => undefined);

    await expect(persistWeightRecord(onAdd, { localDate: "2026-09-10", weightKg: 68.4 })).resolves.toBeUndefined();
    expect(weightSaveSuccessMessage).toContain("保存成功：已记录这次体重");
  });
});
