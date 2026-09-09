# Dashboard Read Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic M1-006 Dashboard read model and API from immutable diary snapshots, with date-bound goal snapshots and a rebuildable daily cache.

**Architecture:** Add a forward analytics migration for `analytics_daily_summary`, extend diary-day creation to bind the effective goal id once, and add a dashboard domain service that composes the existing diary snapshot read with the bound goal. The API exposes one nested read endpoint and never queries current food nutrient values for historical intake.

**Tech Stack:** Node.js 24, TypeScript, `node:sqlite`, Vitest, existing modular workspace and HTTP API.

**Spec:** `docs/superpowers/specs/2026-09-09-dashboard-read-model-design.md`; contracts from `API_SPEC.md`, `DATABASE_SCHEMA.md`, `NUTRITION_ENGINE_SPEC.md`, and `IMPLEMENTATION_ROADMAP.md`.

## Global Constraints

- Historical diary values come only from `diary_entry_nutrient` snapshots.
- `coverage = sum(knownEntryWeight) / sum(relevantEntryWeight)` using stored gram equivalents.
- No goal CRUD is added; M2-001 owns goal writes.
- Unknown and trace values are not silently presented as precise known zeros.
- All writes are transactional and the API uses the existing `{data}` / `{error}` envelope conventions.
- New migrations are forward-only and included in API startup migration order.

---

### Task 1: Goal-bound diary day and analytics cache schema

**Files:**
- Modify: `packages/diary/src/index.ts`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/diary/test/diary.test.ts`
- Test: `packages/db/test/schema.test.ts`

**Interfaces:**
- `diary_day.goal_id` is populated only when the day row is first created.
- Export `ANALYTICS_MIGRATIONS` containing `0009_analytics_daily_summary`.

- [ ] **Step 1: Write failing tests**

Add a diary regression that inserts an old goal, creates a day, inserts a newer goal, and asserts the day retains the old `goal_id`. Add a schema regression that applies all migrations and asserts the summary primary key `(user_id, local_date)` and `calc_version` columns exist.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm exec vitest run packages/diary/test/diary.test.ts packages/db/test/schema.test.ts`.

Expected: the goal binding and analytics table assertions fail because day creation currently leaves `goal_id` null and no analytics migration exists.

- [ ] **Step 3: Implement the minimal schema and binding**

Add the forward migration and update API startup to apply `ANALYTICS_MIGRATIONS`. In diary day creation, select the effective goal for `(userId, date)` inside the existing write transaction and insert its id; never update an existing day's goal id.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused command; expected result is all tests passing.

- [ ] **Step 5: Commit**

```text
git add packages/diary/src/index.ts packages/diary/test/diary.test.ts packages/db/src/schema.ts packages/db/test/schema.test.ts apps/api/src/index.ts
git commit -m "feat: bind diary days to goals and add dashboard cache"
```

### Task 2: Dashboard domain read model

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/src/index.ts`
- Create: `packages/dashboard/test/dashboard.test.ts`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- `createDashboardService(sqlite, options?).getDashboard({ userId, date })` returns the contract in the design spec.
- The service may compose `createDiaryService` but must aggregate only stored snapshot rows and write one cache row per `(userId,date)`.

- [ ] **Step 1: Write failing domain tests**

Cover: goal/intake/macros/meal totals from two diary entries; weighted coverage and trace metadata; `remainingKcal` with a goal; no-goal response; delete-cache-then-rebuild equality; and changing the current goal after day creation leaves the historical dashboard goal unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm exec vitest run packages/dashboard/test/dashboard.test.ts`.

Expected: module resolution or missing service failures.

- [ ] **Step 3: Implement the minimal service**

Create the package, compose the diary snapshot reader, map canonical nutrient ids (`energy_kcal`, `protein_g`, `fat_g`, `carbohydrate_g`, `fiber_g`), compute nullable remaining calories, upsert `analytics_daily_summary` with `DASHBOARD_CALC_VERSION`, and preserve explicit no-data exercise fields.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused dashboard tests and then `pnpm typecheck`; both must exit 0.

- [ ] **Step 5: Commit**

```text
git add packages/dashboard pnpm-workspace.yaml
git commit -m "feat: add dashboard snapshot read model"
```

### Task 3: Dashboard HTTP endpoint

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/dashboard-routes.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- `GET /api/v1/dashboard/:date` returns `{ data: Dashboard }` for valid dates.
- Invalid dates and domain failures return the existing nested error envelope with a stable error code.

- [ ] **Step 1: Write failing route tests**

Add a route test for the complete response and cache rebuild, plus invalid-date validation and a no-goal response.

- [ ] **Step 2: Run route tests and verify RED**

Run `pnpm exec vitest run apps/api/test/dashboard-routes.test.ts`; expected result is 404 until the route is registered.

- [ ] **Step 3: Implement route wiring**

Instantiate the dashboard service after migrations, register the route before the 404 fallback, and map `DashboardError` to the shared API error envelope.

- [ ] **Step 4: Run route tests and verify GREEN**

Run the focused route test and the existing diary/food route tests; all must pass.

- [ ] **Step 5: Commit**

```text
git add apps/api/src/index.ts apps/api/test/dashboard-routes.test.ts apps/api/package.json
git commit -m "feat: expose dashboard read endpoint"
```

### Task 4: Full verification, benchmark, and progress handoff

**Files:**
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md`
- Modify: `.superpowers/sdd/IMPLEMENTATION_ROADMAP/progress.md`
- Modify: `.superpowers/sdd/IMPLEMENTATION_ROADMAP/task-6-report.md`

- [ ] **Step 1: Run focused and full gates**

Run `pnpm exec vitest run packages/dashboard/test/dashboard.test.ts apps/api/test/dashboard-routes.test.ts`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm api:smoke`, and `pnpm docker:smoke`.

- [ ] **Step 2: Run the local query benchmark**

Use a deterministic fixture of at least 1,000 dashboard reads against a warm SQLite database and record p50/p95 in the report. If Docker or a representative 100k fixture is unavailable, record the limitation instead of claiming the roadmap target.

- [ ] **Step 3: Request independent review**

Review the migration, historical goal binding, snapshot-only aggregation, cache rebuild, envelope, and benchmark evidence. Resolve all Critical/Important findings before completion.

- [ ] **Step 4: Update progress and commit evidence**

Only after all commands and the independent review pass, mark M1-006 `DONE`, record exact counts/exit codes and the next step (M1-007 frontend), then commit the progress report.
