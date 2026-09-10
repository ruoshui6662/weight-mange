import { expect, test, type Page } from "@playwright/test";

const password = "e2e-local-password";
const tabs = ["今日", "饮食", "菜谱", "体重", "分析", "我的"] as const;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function expectNavigationContract(page: Page) {
  const nav = page.locator('nav[aria-label="主导航"]:visible').first();
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveCount(6);
  await expect(nav.getByRole("button", { name: "今日" })).toHaveAttribute("aria-current", "page");
  const heights = await buttons.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(heights.every((height) => height >= 44)).toBe(true);
}

async function bootstrap(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /先建立你的空间|欢迎回来/ })).toBeVisible();
  if (await page.getByRole("heading", { name: "先建立你的空间" }).count()) {
    await page.locator('input[name="displayName"]').fill("ui-regression-user");
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "创建并继续" }).click();
  } else {
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "登录" }).click();
  }
  await expect(page.getByRole("heading", { name: /完善|你好/ })).toBeVisible();
  if (await page.getByRole("heading", { name: /完善/ }).count()) {
    await page.locator('input[name="heightCm"]').fill("170");
    await page.getByRole("button", { name: "完成设置" }).click();
  }
  await expect(page.getByRole("heading", { name: /你好，/ })).toBeVisible();
}

test("Data Garden all-page responsive and keyboard regression contract", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await bootstrap(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "今日", exact: true }).first().click();
    await expectNoHorizontalOverflow(page);
    await expectNavigationContract(page);

    const navButton = page.locator('nav[aria-label="主导航"]:visible').first().getByRole("button", { name: "今日" });
    await navButton.focus();
    await expect(navButton).toBeFocused();

    for (const tab of tabs.slice(1)) {
      await page.getByRole("button", { name: tab, exact: true }).first().click();
      await expect(page.getByRole("button", { name: tab, exact: true }).first()).toHaveAttribute("aria-current", "page");
      await expectNoHorizontalOverflow(page);
      const currentNav = page.locator('nav[aria-label="主导航"]:visible').first().getByRole("button");
      const currentHeights = await currentNav.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
      expect(currentHeights.every((height) => height >= 44)).toBe(true);
    }

    await page.getByRole("button", { name: "饮食", exact: true }).first().click();
    for (const [mealKey, mealLabel] of [["breakfast", "早餐"], ["lunch", "午餐"], ["dinner", "晚餐"], ["snack", "加餐"]] as const) {
      const addButton = page.getByRole("button", { name: `添加${mealLabel}食物`, exact: true });
      await expect(addButton).toBeVisible();
      await expect(addButton).toHaveAttribute("data-meal-add", mealKey);
    }
    const addDinner = page.getByRole("button", { name: "添加晚餐食物", exact: true });
    await addDinner.click();
    await expect(page.locator('[data-active-meal="dinner"]')).toContainText("当前添加到：晚餐");
    await expect(page.getByLabel("搜索食物")).toBeFocused();
    const mealButtonHeights = await page.locator("[data-meal-add]").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(mealButtonHeights.every((height) => height >= 44)).toBe(true);
    await page.getByLabel("搜索食物").fill("不存在的回归食物");
    await page.getByRole("button", { name: "搜索食物" }).click();
    await expect(page.getByText("没有找到匹配食物", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("本地食物目录");
  }
});
