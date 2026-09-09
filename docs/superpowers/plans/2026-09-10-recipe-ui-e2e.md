# M3-003 Recipe UI/E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 React/Vite Dashboard 中完成菜谱创建、计算展示、编辑/刷新/复制/删除、加入日记和浏览器验收闭环。

**Architecture:** 保留 Recipe API、recipe snapshot 和 diary snapshot 作为唯一事实来源；新增独立的 `RecipePanel` 组件承载页面状态，通过注入的 typed client 调用现有 API。纯校验、warning 文案和营养展示格式化放在无副作用的 `recipe-ui.ts`，让表单测试不依赖浏览器或数据库；Dashboard 只负责导航、用户时区日期和日记刷新回调。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Playwright、现有 `apps/web/src/api.ts` HTTP client、SQLite 临时 E2E server。

**Spec:** `docs/superpowers/specs/2026-09-10-recipe-ui-e2e-design.md`

## Global Constraints

- 不新增数据库迁移，不改变 Recipe/Diary API 的 snapshot 事实边界。
- UI 首版原料和加入日记只提交 `g`；不在浏览器连接外部食品库。
- 营养计算、coverage、warning、food revision 和 optimistic version 由服务端决定；客户端不重算、不把 null 转成 0。
- 所有写操作使用 `credentials: "include"`；菜谱 id 必须 `encodeURIComponent`。
- 所有按钮和表单控件保持至少 44px 命中高度；360/390/430px 不得横向溢出。
- 不在测试、日志、提交或文档中写入真实密码、Cookie、API Key 或个人数据。
- 每个任务必须先写失败测试并观察 RED，再写最小实现，随后运行该任务的 GREEN 命令并提交。

---

### Task 1: Typed recipe UI contract and six-item navigation

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/flow.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/test/flow.test.ts`
- Modify: `apps/web/test/api.test.ts`

**Interfaces:**
- Produce `RecipeNutrientSummary`, `RecipeWarning`, `RecipeIngredient`, `Recipe`, `RecipeIngredientInput` and `RecipeClient` types for later `RecipePanel` tasks.
- `RecipeClient` must expose `getRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `copyRecipe`, `deleteRecipe`, `refreshRecipeIngredients`, `addRecipeToDiary` and `searchFoods` with the existing endpoint semantics.
- Add `DashboardTab = "recipe"` and `{ key: "recipe", label: "菜谱", status: "ready" }`; preserve the other five keys and their order.

- [ ] **Step 1: Write the failing navigation and client contract tests**

  In `apps/web/test/flow.test.ts`, change the expected key list to `today, diary, recipe, weight, analytics, profile`, assert the recipe item is ready, and assert `normalizeDashboardTab("recipe")` returns `recipe`. In `apps/web/test/api.test.ts`, add a fetch assertion for `copyRecipe("r/1")` and `refreshRecipeIngredients("r/1", ["i/1"])`, including encoded paths and `credentials: "include"`.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run `pnpm --filter @nutrition-tracker/web test -- flow.test.ts api.test.ts`.

  Expected: FAIL on the navigation key/state assertions because the tab list still has five keys. The existing client request assertions may remain green; they are retained as a guard while the response types are narrowed and the new `RecipeClient` interface is introduced.

- [ ] **Step 3: Implement the minimal typed contract and navigation layout**

  Replace the broad recipe `Record<string, unknown>` fields in `api.ts` with explicit nutrient/warning/ingredient types while retaining nullable `per100g` and `perServing`. Export a `RecipeClient` type matching the methods consumed by `RecipePanel`. Add the recipe tab in `flow.ts` and change `.bottom-nav` to `grid-template-columns: repeat(6, 1fr)`; reduce only horizontal button padding if needed to keep the 360px layout within the existing shell.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run `pnpm --filter @nutrition-tracker/web test -- flow.test.ts api.test.ts`.

  Expected: all focused Web tests pass, including URL encoding and credentials assertions.

- [ ] **Step 5: Commit the contract boundary**

  ```bash
  git add apps/web/src/api.ts apps/web/src/flow.ts apps/web/src/styles.css apps/web/test/flow.test.ts apps/web/test/api.test.ts
  git commit -m "feat: add recipe navigation contract"
  ```

### Task 2: Pure recipe form validation and presentation helpers

**Files:**
- Create: `apps/web/src/recipe-ui.ts`
- Create: `apps/web/test/recipe-ui.test.ts`

**Interfaces:**
- `RecipeDraftIngredient = { key: string; foodId: string; name: string; amount: string }`.
- `RecipeDraft = { name: string; cookedWeightG: string; servingCount: string; ingredients: RecipeDraftIngredient[] }`.
- `RecipeFormError = "NAME_REQUIRED" | "INGREDIENT_REQUIRED" | "INGREDIENT_FOOD_REQUIRED" | "INGREDIENT_AMOUNT_INVALID" | "COOKED_WEIGHT_INVALID" | "SERVING_COUNT_INVALID"`.
- `validateRecipeDraft(draft: RecipeDraft): RecipeFormError | null` returns the first deterministic validation error in the order above.
- `warningText(warning: RecipeWarning): string` maps every server warning code used by the calculator to user-visible Chinese text, including ingredient id context when available.
- `nutrientValue(summary: RecipeNutrientSummary | null | undefined): string` returns `—` for missing summaries and formats finite numeric amounts without inventing values.

- [ ] **Step 1: Write failing pure-helper tests**

  Add tests for empty name, no ingredients, missing food selection, zero/negative/non-numeric amounts, optional cooked weight/serving count, every warning code, and null nutrient output. Include a valid draft with one selected food and positive amount that returns `null`.

- [ ] **Step 2: Run the focused helper test and verify RED**

  Run `pnpm --filter @nutrition-tracker/web test -- recipe-ui.test.ts`.

  Expected: FAIL because `recipe-ui.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers**

  Add the exact types and functions above. Parse optional numeric fields only after trimming; preserve empty optional fields as valid null inputs. Use a fixed warning map for `COOKED_WEIGHT_MISSING`, `SERVING_COUNT_MISSING`, `NUTRIENT_COVERAGE_INCOMPLETE`, `NUTRIENT_TRACE`, `NUTRIENT_ESTIMATED`, `NUTRIENT_UNKNOWN` and `RECIPE_INGREDIENT_REFRESH_UNAVAILABLE`.

- [ ] **Step 4: Run the focused helper test and verify GREEN**

  Run `pnpm --filter @nutrition-tracker/web test -- recipe-ui.test.ts`.

  Expected: all validation, warning and null-display tests pass.

- [ ] **Step 5: Commit the pure UI contract**

  ```bash
  git add apps/web/src/recipe-ui.ts apps/web/test/recipe-ui.test.ts
  git commit -m "feat: add recipe ui validation helpers"
  ```

### Task 3: RecipePanel list, editor and calculation result

**Files:**
- Create: `apps/web/src/RecipePanel.tsx`
- Create: `apps/web/test/recipe-panel.test.tsx`

**Interfaces:**
- Export `RecipePanelProps = { today: string; client: RecipeClient; onDiaryReload: () => Promise<void>; onOpenDiary: () => void }`.
- Export `RecipePanel(props: RecipePanelProps): React.ReactElement`.
- `RecipePanel` owns list/detail/editor state and calls `client` methods; it must not calculate nutrient values locally.
- The component exposes stable accessible names used by tests: `新建菜谱`, `保存菜谱`, `搜索原料`, `选择原料`, `编辑菜谱`, `复制菜谱`, `刷新原料`, `删除菜谱`, `加入日记`, `返回菜谱列表`.

- [ ] **Step 1: Write failing component-state tests**

  Build a small injected fake `RecipeClient` in `recipe-panel.test.tsx`. Assert initial loading text, empty list with `新建菜谱`, ready list with recipe name and warning count, error plus `重试`, and editor validation text after submitting an empty draft. Assert a recipe response with `total`, `per100g`, `perServing` renders those sections, while null per-section values render a warning rather than `0`.

- [ ] **Step 2: Run the focused component test and verify RED**

  Run `pnpm --filter @nutrition-tracker/web test -- recipe-panel.test.tsx`.

  Expected: FAIL because `RecipePanel.tsx` does not exist.

- [ ] **Step 3: Implement list, editor and result views**

  Load recipes on mount and retain existing data when a reload fails. Render one ingredient row by default, append/remove rows locally, search through `client.searchFoods`, and store the selected food id/name in the row. Submit `createRecipe` with `g` ingredients and nullable numeric fields. Render server nutrient summaries and warning text using `recipe-ui.ts`; never turn null into zero. Keep busy controls disabled during each request.

- [ ] **Step 4: Run the focused component test and verify GREEN**

  Run `pnpm --filter @nutrition-tracker/web test -- recipe-panel.test.tsx`.

  Expected: loading, empty, ready, error, validation and nutrient/warning assertions pass.

- [ ] **Step 5: Commit the first RecipePanel slice**

  ```bash
  git add apps/web/src/RecipePanel.tsx apps/web/test/recipe-panel.test.tsx
  git commit -m "feat: add recipe list and editor panel"
  ```

### Task 4: Integrate RecipePanel actions with Dashboard

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/test/dashboard-view.test.ts`
- Modify: `apps/web/test/recipe-panel.test.tsx`

**Interfaces:**
- `DashboardView` passes its user-timezone `today`, `api` as the `RecipeClient`, `props.loadDashboard(today)` as `onDiaryReload`, and a callback that switches `activeTab` to `diary` as `onOpenDiary`.
- Recipe detail actions use the current recipe `version`: `updateRecipe(id, { version, name, cookedWeightG, servingCount, ingredients })`, `copyRecipe`, `refreshRecipeIngredients`, `deleteRecipe`, and `addRecipeToDiary(id, { date: today, mealSlotId, amount, unit: "g" })`.

- [ ] **Step 1: Extend tests for Dashboard integration and actions**

  Add the `菜谱` button to the existing Dashboard render assertions. In the injected client tests, assert edit sends the current version, copy opens the returned copy, refresh replaces the detail and renders returned warnings, delete requires confirmation, version conflict keeps the draft and shows reload guidance, and add-to-diary calls `onDiaryReload` then `onOpenDiary`.

- [ ] **Step 2: Run Web tests and verify RED**

  Run `pnpm --filter @nutrition-tracker/web test -- dashboard-view.test.ts recipe-panel.test.tsx`.

  Expected: FAIL because Dashboard has no recipe tab and the action callbacks are not wired.

- [ ] **Step 3: Wire the panel and action/error behavior**

  Render `RecipePanel` when `activeTab === "recipe"`; pass the existing profile-aware `today`. Keep all existing tabs unchanged. Map `RECIPE_VERSION_CONFLICT` to explicit reload guidance, map resource-not-found to a return-list message, preserve drafts on network failure, use `window.confirm` only for delete, and after successful add-to-diary reload the current diary before switching to the diary tab.

- [ ] **Step 4: Run Web tests and verify GREEN**

  Run `pnpm --filter @nutrition-tracker/web test -- dashboard-view.test.ts recipe-panel.test.tsx`.

  Expected: all Dashboard and RecipePanel interaction tests pass.

- [ ] **Step 5: Commit Dashboard integration**

  ```bash
  git add apps/web/src/App.tsx apps/web/test/dashboard-view.test.ts apps/web/test/recipe-panel.test.tsx
  git commit -m "feat: connect recipe panel to dashboard"
  ```

### Task 5: Browser E2E for recipe lifecycle and snapshot stability

**Files:**
- Modify: `e2e/dashboard.spec.ts`
- Modify: `scripts/e2e-server.mjs` only if an additional deterministic food fixture is needed; otherwise leave the existing 馒头 seed unchanged.

**Interfaces:**
- Use the existing temporary SQLite server and authenticated browser session. Extract the current profile-local date from the dashboard eyebrow instead of assuming the machine UTC date.
- Use `page.request` with the browser context cookies only for the final read-back of diary nutrients; no real credentials or external network are added.

- [ ] **Step 1: Add the failing browser flow**

  Extend the existing test after login with: click `菜谱`; create a recipe named `馒头菜谱` with one searched `馒头` ingredient at `100g`, cooked weight `200g`, and serving count `2`; assert total `223 kcal`, per-100g/per-serving sections, and the calculation version. Create a second recipe without cooked weight to assert the missing-weight warning. Copy the first recipe, edit its ingredient amount, refresh its ingredients, add `100g` to breakfast, and assert the diary page shows `馒头菜谱 · 100g`. Read the diary JSON via `page.request`, capture the energy snapshot, update the recipe again, read diary JSON again, and assert the original amount is unchanged. Assert no horizontal overflow at 360px, 390px, and 430px and every navigation button is at least 44px high.

- [ ] **Step 2: Build the current Web bundle and run E2E to verify RED**

  Run `pnpm build` followed by `pnpm test:e2e`.

  Expected: FAIL at the first `菜谱` locator because the recipe tab and flow are not yet implemented.

- [ ] **Step 3: Make the E2E flow deterministic**

  Keep the existing `馒头` fixture with known energy/protein/fat/carb values. Locate recipe elements by labels and roles, not CSS positions. Use the eyebrow date for the diary URL and assert the snapshot nutrient by `nutrientId === "energy_kcal"`; do not assert a hard-coded calendar date.

- [ ] **Step 4: Build and rerun E2E to verify GREEN**

  Run `pnpm build` followed by `pnpm test:e2e`.

  Expected: one Playwright test passes with the complete recipe lifecycle, snapshot stability, 44px hit areas and all three viewport widths.

- [ ] **Step 5: Commit the browser acceptance**

  ```bash
  git add e2e/dashboard.spec.ts scripts/e2e-server.mjs
  git commit -m "test: cover recipe ui lifecycle"
  ```

### Task 6: Full verification, documentation and handoff

**Files:**
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md`
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/README.md` if the current-status line or document index changes.
- Modify: `docs/superpowers/specs/2026-09-10-recipe-ui-e2e-design.md` only if implementation makes an explicit behavior decision different from the approved design.

**Interfaces:**
- Mark M3-003 `DONE` only after every command below exits 0 and the final E2E result is recorded.
- Update M3 completion from `2/6` to `3/6`, current focus to M3-004, next step to MET/运动计算, and append an activity-log entry with the exact test counts and commit ids.

- [ ] **Step 1: Run the complete quality gate**

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:integration
  pnpm build
  pnpm api:smoke
  pnpm test:e2e
  git -c safe.directory='D:/AI编程/体重管理' diff --check
  ```

  Expected: all exit 0; integration may report no matching files and still exit 0; record total test files/tests and Playwright result.

- [ ] **Step 2: Update the single source of truth**

  Record start/completion times in Asia/Shanghai, focused Web/E2E evidence, any resolved issue, the Docker CLI limitation if still present, and the exact next task M3-004. Do not claim container validation that was not run.

- [ ] **Step 3: Review the final diff**

  Run `git -c safe.directory='D:/AI编程/体重管理' status --short` and `git -c safe.directory='D:/AI编程/体重管理' diff --check`; confirm no secrets, temporary DBs, screenshots or generated dist files are staged.

- [ ] **Step 4: Commit the acceptance evidence**

  ```bash
  git add plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md plan/nutrition_tracker_tech_manual_2026-09-08/README.md docs/superpowers/specs/2026-09-10-recipe-ui-e2e-design.md
  git commit -m "docs: record recipe ui acceptance"
  ```

## Plan Self-Review

- **Spec coverage:** navigation, form validation, local food search, g-only input, total/per100g/perServing display, warnings, loading/empty/error states, version conflict, refresh/copy/delete, add-to-diary and history snapshot stability are covered by Tasks 1–5.
- **Placeholder scan:** no unresolved placeholder, unspecified error step, or undefined function name is used; every task has files, interfaces, RED/GREEN commands and a commit.
- **Type consistency:** Task 1 defines `RecipeClient` and nutrient types; Tasks 3–4 consume those exact names; Task 5 uses the API route and diary response already defined by the repository.
- **Scope check:** no database migration, external food source, 운동 domain or AI behavior is introduced; Task 6 only updates the project progress source of truth.
