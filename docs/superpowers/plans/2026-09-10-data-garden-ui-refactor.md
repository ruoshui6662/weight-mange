# Data Garden UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task is independent, reviewed, and committed before the next task starts.

**Goal:** 将现有移动优先但桌面溢出的 React/Vite 界面，重构为以 Data Garden 方案为基线的桌面三栏、移动单栏、六页一致 UI，并保留现有 API、snapshot 和离线边界。

**Architecture:** 先抽出 tokens、AppShell、Sidebar、MobileBottomNav、PageHeader、Button、Surface、状态组件，再让每个页面只负责自己的主任务内容。DashboardView 继续承载会话与数据加载编排，但页面视觉组件按职责拆分，避免通过复制 CSS 形成第二套设计系统。服务端 contract、数据库和营养计算不改动。

**Tech Stack:** React 19, TypeScript, Vite, CSS modules-free global tokens, Vitest/React server rendering tests, Playwright Chromium E2E.

**Spec:** `plan/nutrition_tracker_tech_manual_2026-09-08/UI_DESIGN_SYSTEM.md`

## Global Constraints

- 页面视觉基线固定为 Data Garden：`#F4F7F6` 页面底色、白色 surface、`#35C887` 主行动色、深森林绿文字。
- 桌面 `>=1200px` 使用 `216px sidebar + main + 288px context rail`；不得将手机单列卡片放大到 PC。
- `320–430px` 不得横向溢出；所有按钮、输入、图标按钮命中区至少 `44px`。
- 每个页面只有一个 Primary action；蛋白质/脂肪/碳水分别固定 coral/sunflower/mint 颜色。
- 复用现有 API 和事实边界；不新增数据库迁移，不让客户端重算服务端营养结果。
- 保留 snapshot、coverage、estimated、unknown、冲突、离线和本地目录搜索语义。
- 所有新行为先写失败测试；每个任务运行自己的聚焦测试、typecheck 和 `git diff --check` 后提交。
- 真实密码、Cookie、API key、Authorization 和个人数据不得进入代码、测试、文档或截图。

---

### Task 1: Data Garden tokens and shared application shell

**Files:**
- Create: `apps/web/src/ui/tokens.ts` — typed semantic token names used by component tests.
- Create: `apps/web/src/ui/AppShell.tsx` — desktop sidebar, mobile bottom nav, page header, context rail slots.
- Create: `apps/web/src/ui/Primitives.tsx` — Button, Surface, StatusMessage, Metric, IconButton contracts.
- Modify: `apps/web/src/App.tsx` — use shared shell primitives without changing API/data loading behavior.
- Modify: `apps/web/src/styles.css` — replace legacy centered mobile card rules with Data Garden tokens and responsive shell rules.
- Create: `apps/web/test/ui-shell.test.tsx` — navigation, ARIA, button variants, 44px contract markers.

**Interfaces:**
- `AppShell({ activeTab, onNavigate, title, eyebrow, primaryAction, children, rail })` renders the same shell at every dashboard tab.
- `Button({ variant, busy, children, ...buttonProps })` accepts `primary | secondary | tertiary | destructive`.
- `StatusMessage({ kind, title, description, action })` accepts `loading | empty | error | offline | conflict | success | warning`.

- [ ] Step 1: Add failing tests for six navigation items, `aria-current`, one primary action marker, button variants, and no legacy `shell` max-width contract.
- [ ] Step 2: Run `pnpm vitest run apps/web/test/ui-shell.test.tsx`; confirm the new module/markers fail.
- [ ] Step 3: Implement tokens, shared primitives and responsive shell. Keep existing callbacks and tab keys unchanged.
- [ ] Step 4: Run focused shell tests, `pnpm typecheck`, and `git diff --check`; confirm pass.
- [ ] Step 5: Commit `feat: add data garden application shell`.

### Task 2: Rebuild 今日 as the Data Garden dashboard

**Files:**
- Create: `apps/web/src/ui/TodayPage.tsx` — calorie hero, macro bars, meal grid, weekly overview and context rail.
- Modify: `apps/web/src/App.tsx` — route `activeTab === "today"` to `TodayPage`, pass existing Dashboard/Diary data and callbacks.
- Modify: `apps/web/src/styles.css` — hero ring, macro rows, meal groups, desktop two-column and mobile one-column layout.
- Modify: `apps/web/test/dashboard-view.test.ts` — assert primary action, hero labels, meal groups and explicit empty state.
- Create: `apps/web/test/today-page.test.tsx` — desktop structure, no duplicate primary action, data quality labels.

**Interfaces:**
- `TodayPage({ today, dashboard, diary, profile, onAddFood, onCopyDay, onCopyMeal, onEdit, onDelete, onSave, onLogout })` consumes the current snapshot data only.

- [ ] Step 1: Add failing render tests for “还可以吃”, `1545 kcal`-style numeric hierarchy, four meal groups, fixed macro semantics, and quick-record rail.
- [ ] Step 2: Run focused Today tests and observe failure against the old hero/mobile layout.
- [ ] Step 3: Implement the Data Garden dashboard composition with no new API calls.
- [ ] Step 4: Run focused tests, `pnpm typecheck`, and Playwright viewport assertions for 1440/1024/390.
- [ ] Step 5: Commit `feat: rebuild data garden today page`.

### Task 3: Rebuild 饮食 as a desktop search-and-confirm workspace

**Files:**
- Create: `apps/web/src/ui/DiaryPage.tsx` — local food search, tabs, result rows, quantity confirmation and meal summaries.
- Modify: `apps/web/src/App.tsx` — route diary tab to `DiaryPage`, preserve existing search/add/edit/delete/copy actions.
- Modify: `apps/web/src/styles.css` — two-column desktop search workspace, drawer/sheet responsive rules, list rows.
- Modify: `apps/web/test/dashboard-view.test.ts` — move diary assertions to the new page contract.
- Create: `apps/web/test/diary-page.test.tsx` — local search empty guidance, quantity/meal controls, loading/error states.

**Interfaces:**
- `DiaryPage({ today, dashboard, diary, searchState, onSearch, onAddEntry, onEdit, onDelete, onCopyDay, onCopyMeal })` does not calculate nutrition locally.

- [ ] Step 1: Write failing tests for local-catalog copy, full-row food selection, `− value +` quantity control, and mobile Sheet labels.
- [ ] Step 2: Run focused tests and confirm old FoodSearchCard does not satisfy the new contract.
- [ ] Step 3: Implement the workspace while preserving API error mapping and snapshot copy behavior.
- [ ] Step 4: Run focused tests, typecheck, and 360/390/430 overflow/hit-target checks.
- [ ] Step 5: Commit `feat: rebuild data garden diary page`.

### Task 4: Rebuild 菜谱 with stable editor/result hierarchy

**Files:**
- Modify: `apps/web/src/RecipePanel.tsx` — keep existing action helpers and API boundary; change layout to list/editor/result/explicit-action sections.
- Modify: `apps/web/src/styles.css` — recipe three-zone desktop layout and mobile vertical editor.
- Modify: `apps/web/test/recipe-panel.test.tsx` — assert shared button hierarchy, result order, warnings and mobile-safe structure.
- Modify: `e2e/dashboard.spec.ts` — update recipe selectors only where the new accessible names require it.

**Interfaces:**
- Existing `RecipeClient`, recipe draft validation, snapshot preservation, conflict reload and explicit refresh functions remain unchanged.

- [ ] Step 1: Add failing tests for one primary “保存菜谱”, secondary explicit refresh/copy/add-to-diary, destructive delete, and total/per100g/perServing ordering.
- [ ] Step 2: Run focused RecipePanel tests and confirm current card layout fails the new semantic assertions.
- [ ] Step 3: Implement the new hierarchy without changing recipe calculations or snapshot semantics.
- [ ] Step 4: Run focused recipe tests, typecheck, build and recipe E2E at 360/390/430.
- [ ] Step 5: Commit `feat: rebuild data garden recipe page`.

### Task 5: Rebuild 体重 as a trend-first page

**Files:**
- Create: `apps/web/src/ui/WeightPage.tsx` — current weight hero, record form, 7/30 day trend, summary and recent records.
- Modify: `apps/web/src/App.tsx` — route weight tab and preserve existing weight API calls.
- Modify: `apps/web/src/styles.css` — trend surface, point/line legend, mobile summary list.
- Modify: `apps/web/test/dashboard-view.test.ts` — update WeightPage assertions.
- Create: `apps/web/test/weight-page.test.tsx` — insufficient data, loading/error, record form and unit display.

- [ ] Step 1: Write failing tests for explicit “数据不足” copy, kg unit, record action, and no fake zero points.
- [ ] Step 2: Run focused tests and confirm the current compact card does not expose the page contract.
- [ ] Step 3: Implement the trend-first layout using existing WeightTrend data.
- [ ] Step 4: Run focused tests, typecheck and responsive viewport checks.
- [ ] Step 5: Commit `feat: rebuild data garden weight page`.

### Task 6: Rebuild 分析 as evidence-first read model

**Files:**
- Create: `apps/web/src/ui/AnalyticsPage.tsx` — period selector, averages, coverage, weight delta and Adaptive TDEE explanation.
- Modify: `apps/web/src/App.tsx` — route analytics tab and preserve existing read-only API behavior.
- Modify: `apps/web/src/styles.css` — evidence-first charts/summaries and mobile order.
- Modify: `apps/web/test/dashboard-view.test.ts` — update AnalyticsPage assertions.
- Create: `apps/web/test/analytics-page.test.tsx` — fact/estimate/insufficient states and period control.

- [ ] Step 1: Write failing tests for separate fact vs estimate labels, coverage, no-data copy, and no auto goal mutation.
- [ ] Step 2: Run focused tests and confirm old panel is too dense/ambiguous.
- [ ] Step 3: Implement the read-only analysis page with no new estimates in the client.
- [ ] Step 4: Run focused tests, typecheck, build and responsive checks.
- [ ] Step 5: Commit `feat: rebuild data garden analytics page`.

### Task 7: Rebuild 我的 and auth/setup surfaces

**Files:**
- Create: `apps/web/src/ui/ProfilePage.tsx` — profile, goals, data/backup guidance, danger zone.
- Create: `apps/web/src/ui/AuthShell.tsx` — shared bootstrap/login/setup visual shell using the same tokens.
- Modify: `apps/web/src/App.tsx` — route profile and auth/setup surfaces through shared shell components without changing auth behavior.
- Modify: `apps/web/src/styles.css` — profile settings rows, danger zone, onboarding responsive layout.
- Modify: `apps/web/test/dashboard-view.test.ts` — assert profile settings structure.
- Create: `apps/web/test/auth-shell.test.tsx` — login/bootstrap/setup shared visual contract and error/disabled states.

- [ ] Step 1: Write failing tests for profile setting rows, danger zone separation, form labels and actionable errors.
- [ ] Step 2: Run focused tests and confirm the old profile panel/auth Shell do not satisfy the structure.
- [ ] Step 3: Implement shared auth/profile surfaces, retaining existing validation and API calls.
- [ ] Step 4: Run focused tests, typecheck, build and onboarding E2E.
- [ ] Step 5: Commit `feat: rebuild data garden profile and auth pages`.

### Task 8: Cross-page visual QA, accessibility and handoff

**Files:**
- Modify: `e2e/dashboard.spec.ts` — cover all six nav surfaces at 1440/1024/430/390/360, overflow and 44px controls.
- Create: `e2e/ui-regression.spec.ts` — keyboard focus, primary action count, loading/empty/error visibility and mobile bottom-nav safe area.
- Modify: `apps/web/test/ui-shell.test.tsx` and page tests — close any cross-page semantic gaps.
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md` — record task status and evidence.
- Create: `docs/superpowers/sdd/2026-09-10-data-garden-ui-refactor/task-8-report.md` — final gate evidence.

- [ ] Step 1: Add failing E2E assertions for each viewport and tab, then run to observe the missing evidence.
- [ ] Step 2: Implement only the minimal test/selector adjustments required by the final UI.
- [ ] Step 3: Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm api:smoke`, `pnpm test:e2e`, and `git -c safe.directory='D:/AI编程/体重管理' diff --check`.
- [ ] Step 4: Record exact exit codes, test counts, viewport coverage, local Docker limitation, and next M3 task.
- [ ] Step 5: Commit `docs: record data garden ui acceptance`.

## Plan self-review

- Coverage: Tasks 1–2 cover shell/tokens and 今日; Tasks 3–7 cover 饮食、菜谱、体重、分析、我的和 auth/setup; Task 8 covers cross-page accessibility, responsive and full-gate evidence.
- Scope: no API, database, nutrition-engine or snapshot behavior changes; existing calls remain the source of truth.
- Isolation: tasks are sequential because `App.tsx` and `styles.css` are shared; each still has a focused test contract and independent commit.
- Placeholder scan: no unresolved task placeholder is part of the plan; every step names files, behavior, command and commit.
