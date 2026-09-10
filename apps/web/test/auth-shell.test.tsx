import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthShell } from "../src/ui/AuthShell";
import { ProfilePage } from "../src/ui/ProfilePage";

describe("Data Garden identity surfaces", () => {
  it("shares the auth shell contract across identity forms", () => {
    const html = renderToStaticMarkup(<AuthShell eyebrow="FIRST SETUP" title="先建立你的空间" subtitle="数据保存在你自己的服务中。"><form><label htmlFor="password">密码（至少 12 个字符）</label><input id="password" name="password" type="password" /><button type="submit">创建并继续</button></form></AuthShell>);
    expect(html).toContain("dg-auth-shell");
    expect(html).toContain("FIRST SETUP");
    expect(html).toContain('for="password"');
    expect(html).toContain("创建并继续");
  });

  it("exposes actionable auth error and disabled state", () => {
    const html = renderToStaticMarkup(<AuthShell eyebrow="LOGIN" title="欢迎回来" error="密码不正确，请重试。" busy><form><label htmlFor="login-password">密码</label><input id="login-password" name="password" type="password" /><button type="submit" disabled>正在登录…</button></form></AuthShell>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("密码不正确，请重试。");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
  });

  it("separates profile settings from the danger zone", () => {
    const html = renderToStaticMarkup(<ProfilePage profile={{ id: "u1", displayName: "ruoshui", timezone: "Asia/Shanghai", body: { heightCm: 170, sexForFormula: "none", activityLevel: "light" } }} showImportGuide={false} onToggleImportGuide={() => undefined} />);
    expect(html).toContain("账户与身份");
    expect(html).toContain("目标与偏好");
    expect(html).toContain("数据与备份");
    expect(html).toContain("危险操作");
    expect(html).toContain("查看食物目录导入说明");
    expect(html).toContain("本地账户");
  });
});
