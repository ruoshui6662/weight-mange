import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../src/ui/AppShell";
import { Button, IconButton, Metric, StatusMessage, Surface } from "../src/ui/Primitives";
import { DATA_GARDEN_TOKENS } from "../src/ui/tokens";

describe("Data Garden application shell", () => {
  it("renders the six tabs in product order with an accessible current page", () => {
    const html = renderToStaticMarkup(<AppShell activeTab="diary" onNavigate={vi.fn()} title="饮食"><p>内容</p></AppShell>);
    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain('aria-current="page"');
    expect(html.indexOf("今日")).toBeLessThan(html.indexOf("饮食"));
    expect(html.indexOf("饮食")).toBeLessThan(html.indexOf("菜谱"));
    expect(html.indexOf("菜谱")).toBeLessThan(html.indexOf("体重"));
    expect(html.indexOf("体重")).toBeLessThan(html.indexOf("分析"));
    expect(html.indexOf("分析")).toBeLessThan(html.indexOf("我的"));
    expect(html).toContain("data-shell-sidebar");
    expect(html).toContain("data-shell-bottom-nav");
    expect(html).toContain('class="dg-nav" aria-label="主导航"');
    expect(html).toContain('data-nav-icon="today"');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/data-nav-icon=/g)).toHaveLength(12);
  });

  it("exposes one primary action and keeps context rail optional", () => {
    const html = renderToStaticMarkup(<AppShell activeTab="today" onNavigate={vi.fn()} title="今日" primaryAction={<Button>记录饮食</Button>} rail={<aside>提示</aside>}><p>内容</p></AppShell>);
    expect(html.match(/data-button-variant="primary"/g)).toHaveLength(1);
    expect(html).toContain("data-context-rail");
  });

  it("supports all semantic button variants and busy feedback", () => {
    const html = renderToStaticMarkup(<>
      <Button variant="primary">保存</Button><Button variant="secondary">查看</Button>
      <Button variant="tertiary">取消</Button><Button variant="destructive">删除</Button>
      <Button busy>保存</Button>
    </>);
    expect(html).toContain('data-button-variant="primary"');
    expect(html).toContain('data-button-variant="secondary"');
    expect(html).toContain('data-button-variant="tertiary"');
    expect(html).toContain('data-button-variant="destructive"');
    expect(html).toContain("保存中…");
    expect(html).toContain("disabled");
  });

  it("renders readable status semantics, metrics, surfaces and a 44px icon hit marker", () => {
    const html = renderToStaticMarkup(<>
      <Surface><Metric label="今日摄入" value="1545" unit="kcal" /></Surface>
      <StatusMessage kind="warning" title="数据不足" description="还需要更多记录。" />
      <IconButton label="关闭">×</IconButton>
    </>);
    expect(html).toContain("数据不足");
    expect(html).toContain("还需要更多记录");
    expect(html).toContain('data-hit-area="44"');
    expect(html).toContain("1545");
  });

  it("exposes the Data Garden semantic tokens", () => {
    expect(DATA_GARDEN_TOKENS.color.page).toBe("#F4F7F6");
    expect(DATA_GARDEN_TOKENS.color.primary).toBe("#35C887");
    expect(DATA_GARDEN_TOKENS.layout.sidebar).toBe("216px");
  });

  it("keeps compact sidebar labels accessible while the visual label collapses", () => {
    const html = renderToStaticMarkup(<AppShell activeTab="today" onNavigate={vi.fn()} title="今日"><p>内容</p></AppShell>);
    expect(html).toContain('class="dg-nav-label"');
    expect(html).toContain('aria-label="今日"');
    expect(html).toContain("dg-sidebar");
  });
});
