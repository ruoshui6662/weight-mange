import { expect, test, type Page } from "@playwright/test";

const testPassword = "e2e-local-password";

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("首次设置、食物搜索、体重写入和分析不足状态在目标 viewport 可用", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /先建立你的空间|欢迎回来/ })).toBeVisible();

  if (await page.getByRole("heading", { name: "先建立你的空间" }).count()) {
    await page.locator('input[name="displayName"]').fill("e2e-user");
    await page.locator('input[name="password"]').fill(testPassword);
    await page.getByRole("button", { name: "创建并继续" }).click();
    await expect(page.getByRole("heading", { name: /完善/ })).toBeVisible();
    await page.locator('input[name="heightCm"]').fill("170");
    await page.getByRole("button", { name: "完成设置" }).click();
  } else {
    await page.locator('input[name="password"]').fill(testPassword);
    await page.getByRole("button", { name: "登录" }).click();
  }

  await expect(page.getByRole("heading", { name: "你好，e2e-user" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "饮食" }).click();
  await page.getByLabel("搜索食物").fill("馒头");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("button", { name: /馒头.*223 kcal/ })).toBeVisible();
  await page.getByRole("button", { name: /馒头.*223 kcal/ }).click();
  await page.getByRole("button", { name: "加入记录" }).click();
  await page.getByRole("button", { name: "今日" }).click();
  await expect(page.getByText("馒头 · 100g", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "饮食" }).click();
  await page.getByLabel("搜索食物").fill("不存在食物");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("没有找到匹配食物")).toBeVisible();
  await page.getByRole("button", { name: "查看导入说明" }).click();
  await expect(page.getByText("本地目录导入")).toBeVisible();

  await page.getByRole("button", { name: "体重" }).click();
  await expect(page.getByText("暂无体重记录")).toBeVisible();
  await page.locator('input[name="weightKg"]').fill("70");
  await page.getByRole("button", { name: "添加体重" }).click();
  await expect(page.getByText("70.0 kg", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "分析" }).click();
  await expect(page.getByText("数据不足", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("viewport-360.png"), fullPage: true });

  await page.getByRole("button", { name: "退出" }).click();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await page.locator('input[name="password"]').fill(testPassword);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "你好，e2e-user" })).toBeVisible();
  const navHeights = await page.getByRole("navigation", { name: "主导航" }).getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(navHeights.every((height) => height >= 44)).toBe(true);

  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`viewport-${viewport.width}.png`), fullPage: true });
  }
});
