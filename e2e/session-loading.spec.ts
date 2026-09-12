import { expect, test, type Page } from "@playwright/test";

const profile = { id: "session-test", displayName: "恢复测试", timezone: "Asia/Shanghai", body: { heightCm: 170, sexForFormula: "none", activityLevel: "light" } };
const date = "2026-09-12";
const diary = { mealSlots: [{ id: "breakfast", key: "breakfast", displayName: "早餐" }], entries: [{ id: "saved", mealSlotId: "breakfast", displayNameSnapshot: "已保存的早餐", amount: 100, unit: "g", version: 1 }] };
const dashboard = { date, goal: { kcal: 1800, proteinG: 90, fatG: 60, carbG: 225 }, intake: { kcal: 300, proteinG: 10, fatG: 5, carbG: 50 }, remainingKcal: 1500, meals: [{ key: "breakfast", displayName: "早餐", totals: { kcal: 300 } }] };

async function mockSession(page: Page, authenticated = true) {
  await page.clock.setFixedTime(new Date("2026-09-11T18:00:00Z"));
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown;
    if (path.endsWith("/auth/status")) data = { initialized: true };
    else if (path.endsWith("/auth/session")) data = { authenticated, user: authenticated ? profile : null };
    else if (path.endsWith("/auth/login")) { authenticated = true; data = { user: profile }; }
    else if (path.endsWith("/auth/logout")) { await route.fulfill({ status: 204 }); return; }
    else if (path.endsWith("/profile")) data = profile;
    else if (path.endsWith("/profile/goals")) data = [{ id: "goal", calorieTargetKcal: 1800, effectiveFrom: date }];
    else if (path === `/api/v1/dashboard/${date}`) data = dashboard;
    else if (path === `/api/v1/diary/${date}`) data = diary;
    else if (path.endsWith("/body/weights")) data = [];
    else if (path.endsWith("/body/weight-trend")) data = { methodVersion: "test", windowDays: 7, method: "ewma", alpha: 0.3, observedDays: 0, points: [] };
    else if (path.endsWith("/analytics/overview")) data = { period: { from: url.searchParams.get("from"), to: date, days: 90 }, recordCoverage: { recordedDays: 1, totalDays: 90, ratio: 1 / 90 }, averages: { intakeKcal: 900, proteinG: 10, fatG: 5, carbG: 50 }, goal: { days: 1, averageKcal: 1800, averageDifferenceKcal: -900 }, weight: { observedDays: 0, startKg: null, endKg: null, deltaKg: null } };
    else if (path.endsWith("/analytics/tdee")) data = { methodVersion: "test", status: "insufficient_data", reason: null, rawTdeeKcal: null, estimatedTdeeKcal: null, confidence: 0, recommendedCalorieTargetKcal: null, period: { from: url.searchParams.get("from"), to: date } };
    else { await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } }); return; }
    await route.fulfill({ json: { data } });
  });
}

test("已有会话刷新读取用户时区当天的真实日记和预算", async ({ page }) => {
  await mockSession(page);
  await page.goto("/");
  await expect(page.getByText("已保存的早餐 · 100g", { exact: true })).toBeVisible();
  await expect(page.getByText("1500 kcal", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("已保存的早餐 · 100g", { exact: true })).toBeVisible();
  await expect(page.getByText(`TODAY · ${date}`, { exact: true })).toBeVisible();
});

test("主动登录也按刚读取的资料时区加载，而非旧 UTC 日期", async ({ page }) => {
  await mockSession(page, false);
  await page.goto("/");
  await page.getByLabel("密码", { exact: true }).fill("fixture-password-only");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByText("已保存的早餐 · 100g", { exact: true })).toBeVisible();
});

for (const endpoint of ["auth/status", "profile", `dashboard/${date}`]) {
  test(`${endpoint} 服务失败提供读取重试，不误导到登录`, async ({ page }) => {
    await mockSession(page);
    let failing = true;
    await page.route(`**/api/v1/${endpoint}`, (route) => failing ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }) : route.fallback());
    await page.goto("/");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "登录", exact: true })).toHaveCount(0);
    failing = false;
    await page.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(page.getByText("已保存的早餐 · 100g", { exact: true })).toBeVisible();
  });
}

test("受保护读取返回 401 才进入重新登录", async ({ page }) => {
  await mockSession(page);
  await page.route("**/api/v1/profile", (route) => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("登录已失效");
});

test("切换分析周期后旧请求的迟到错误不能覆盖新周期", async ({ page }) => {
  await mockSession(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/api/v1/analytics/overview?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("from") === "2026-08-14") {
      started(); await gate;
      await route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } });
    } else await route.fallback();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "分析", exact: true }).first().click();
  await pending;
  await page.getByRole("tab", { name: "90 天", exact: true }).click();
  await expect(page.getByText("900 kcal", { exact: true })).toBeVisible();
  const response = page.waitForResponse((res) => res.url().includes("from=2026-08-14") && res.url().includes("/overview"));
  release(); await response;
  // A following browser task observes React's update from the completed response.
  await page.getByRole("tab", { name: "90 天", exact: true }).focus();
  await expect(page.getByText("900 kcal", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("退出失败时当前页面读取仍能完成，不遗留永久加载", async ({ page }) => {
  await mockSession(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/api/v1/analytics/overview?**", async (route) => { started(); await gate; await route.fallback(); });
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "分析", exact: true }).first().click();
  await pending;
  await page.getByRole("button", { name: "退出", exact: true }).click();
  release();
  await expect(page.getByText("900 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("正在加载分析", { exact: true })).toHaveCount(0);
});

test("离开体重页后迟到的保存刷新不能抢占分析读取", async ({ page }) => {
  await mockSession(page);
  let releaseWeight!: () => void;
  const weightGate = new Promise<void>((resolve) => { releaseWeight = resolve; });
  let weightStarted!: () => void;
  const pendingWeight = new Promise<void>((resolve) => { weightStarted = resolve; });
  await page.route("**/api/v1/body/weights", async (route) => {
    if (route.request().method() === "POST") {
      weightStarted(); await weightGate;
      await route.fulfill({ json: { data: { id: "w1", measuredAt: "2026-09-11T18:00:00Z", localDate: date, weightKg: 70, source: "manual", note: null, version: 1 } } });
    } else await route.fallback();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "体重", exact: true }).first().click();
  await page.getByLabel("体重（kg）", { exact: true }).fill("70");
  await page.getByRole("button", { name: "添加体重", exact: true }).click();
  await pendingWeight;
  await page.getByRole("button", { name: "分析", exact: true }).first().click();
  releaseWeight();
  await expect(page.getByText("900 kcal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把记录变成可读证据" })).toBeVisible();
});
