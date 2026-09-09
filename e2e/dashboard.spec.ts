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

  await page.getByRole("button", { name: "菜谱" }).click();
  await page.getByRole("button", { name: "新建菜谱" }).click();
  await page.getByLabel("菜谱名称").fill("馒头菜谱");
  await page.getByLabel("成品重量").fill("200");
  await page.getByLabel("份数").fill("2");
  await page.getByLabel("原料搜索").fill("馒头");
  await page.getByRole("button", { name: "搜索原料" }).click();
  await expect(page.getByRole("button", { name: "选择原料" })).toBeVisible();
  await page.getByRole("button", { name: "选择原料" }).click();
  await page.getByRole("button", { name: "保存菜谱" }).click();
  await expect(page.getByRole("heading", { name: "馒头菜谱", exact: true })).toBeVisible();
  await expect(page.getByText("总营养", { exact: true })).toBeVisible();
  await expect(page.getByText("每100克营养", { exact: true })).toBeVisible();
  await expect(page.getByText("每份营养", { exact: true })).toBeVisible();
  await expect(page.getByText("223", { exact: true })).toBeVisible();
  await expect(page.getByText(/计算版本/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "返回菜谱列表" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "新建菜谱" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("菜谱名称").fill("无成品重量菜谱");
  await page.getByLabel("原料搜索").fill("馒头");
  await page.getByRole("button", { name: "搜索原料" }).click();
  await page.getByRole("button", { name: "选择原料" }).click();
  await page.getByRole("button", { name: "保存菜谱" }).click();
  await expect(page.getByText("未填写成品重量，无法展示每100克营养。", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "返回菜谱列表" }).click();
  const firstRecipe = page.getByRole("article").filter({ hasText: "馒头菜谱" }).first();
  await firstRecipe.getByRole("button", { name: "查看菜谱" }).click();
  await page.getByRole("button", { name: "复制菜谱" }).click();
  await expect(page.getByRole("heading", { name: "馒头菜谱（副本）", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑菜谱" }).click();
  await page.getByLabel("原料用量").fill("150");
  await page.getByRole("button", { name: "保存菜谱" }).click();
  await page.getByRole("button", { name: "刷新原料" }).click();
  await expect(page.getByText(/原料：馒头 150g/)).toBeVisible();
  await page.getByRole("button", { name: "加入日记" }).click();

  const eyebrow = await page.getByText(/^(TODAY|DIARY|RECIPE) · \d{4}-\d{2}-\d{2}$/).first().textContent();
  const today = eyebrow?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  expect(today).toBeTruthy();
  await expect(page.getByRole("button", { name: "饮食" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("馒头菜谱（副本） · 100g", { exact: true })).toBeVisible();

  const diaryResponse = await page.request.get(`/api/v1/diary/${today}`);
  expect(diaryResponse.ok()).toBe(true);
  const firstDiary = (await diaryResponse.json()).data;
  const recipeEntry = firstDiary.entries.find((entry: { displayNameSnapshot: string }) => entry.displayNameSnapshot === "馒头菜谱（副本）");
  expect(recipeEntry).toBeTruthy();
  const originalEnergy = recipeEntry.nutrients.find((nutrient: { nutrientId: string }) => nutrient.nutrientId === "energy_kcal").amountNumeric;
  expect(originalEnergy).toBeCloseTo(167.25);

  const recipeResponse = await page.request.get(`/api/v1/recipes/${recipeEntry.recipeId}`);
  expect(recipeResponse.ok()).toBe(true);
  const recipeData = (await recipeResponse.json()).data;
  const updatedRecipeResponse = await page.request.fetch(`/api/v1/recipes/${recipeEntry.recipeId}`, {
    method: "PATCH",
    data: { version: recipeData.version, cookedWeightG: 100 },
  });
  expect(updatedRecipeResponse.ok()).toBe(true);
  const secondDiaryResponse = await page.request.get(`/api/v1/diary/${today}`);
  expect(secondDiaryResponse.ok()).toBe(true);
  const secondDiary = (await secondDiaryResponse.json()).data;
  const unchangedEntry = secondDiary.entries.find((entry: { id: string }) => entry.id === recipeEntry.id);
  expect(unchangedEntry.nutrients.find((nutrient: { nutrientId: string }) => nutrient.nutrientId === "energy_kcal").amountNumeric).toBe(originalEnergy);

  await page.getByRole("button", { name: "菜谱", exact: true }).click();
  const copiedRecipeCard = page.getByRole("article").filter({ hasText: "馒头菜谱（副本）" }).first();
  await copiedRecipeCard.getByRole("button", { name: "查看菜谱" }).click();
  await expect(page.getByRole("heading", { name: "馒头菜谱（副本）", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  page.once("dialog", (dialog) => { void dialog.accept(); });
  await page.getByRole("button", { name: "删除菜谱", exact: true }).click();
  await expect(page.getByRole("heading", { name: "菜谱", exact: true })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "馒头菜谱（副本）" })).toHaveCount(0);

  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "菜谱", exact: true }).click();
    await expect(page.getByRole("heading", { name: "菜谱", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const recipeNavButtons = page.getByRole("navigation", { name: "主导航" }).getByRole("button");
    await expect(recipeNavButtons).toHaveCount(6);
    const recipeNavHeights = await recipeNavButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(recipeNavHeights.every((height) => height >= 44)).toBe(true);
  }

  await page.getByRole("button", { name: "饮食" }).click();
  await page.getByLabel("搜索食物").fill("馒头");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("button", { name: /馒头.*223 kcal/ })).toBeVisible();
  await page.getByRole("button", { name: /馒头.*223 kcal/ }).click();
  await page.getByRole("button", { name: "加入记录" }).click();
  await page.getByRole("button", { name: "今日" }).click();
  await expect(page.getByText("馒头 · 100g", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "编辑馒头", exact: true }).click();
  await page.locator('input[name^="edit-amount-"]').fill("120");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByText("馒头 · 120g", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "饮食" }).click();
  await expect(page.getByRole("button", { name: "复制昨日整天" })).toBeVisible();
  await page.getByRole("button", { name: "复制昨日整天" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "今日" }).click();
  page.once("dialog", (dialog) => { void dialog.accept(); });
  await page.getByRole("button", { name: "删除馒头", exact: true }).click();
  await expect(page.getByText("馒头 · 120g", { exact: true })).toHaveCount(0);

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
    const viewportNavHeights = await page.getByRole("navigation", { name: "主导航" }).getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(viewportNavHeights.every((height) => height >= 44)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`viewport-${viewport.width}.png`), fullPage: true });
  }
});
