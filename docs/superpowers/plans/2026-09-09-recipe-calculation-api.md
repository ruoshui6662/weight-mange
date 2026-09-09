# Recipe Calculation and API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver M3-002 recipe persistence, deterministic `total/per100g/perServing` calculation, cooked-yield warnings, copy/edit/delete/explicit refresh, and recipe-to-diary snapshot writes without changing existing diary history.

**Architecture:** Add a forward-only recipe migration and a focused `@nutrition-tracker/recipe` package. The package resolves an active food only when creating or explicitly refreshing an ingredient, stores the resolved nutrient values as immutable ingredient snapshots, calculates from those snapshots with `recipe_yield_v1`, and lazily rebuilds an invalidatable cache. Extend the diary service with a recipe snapshot writer, then expose the recipe service through authenticated API routes and typed web client methods; M3-003 will own the UI.

**Tech Stack:** Node.js 24, TypeScript, `node:sqlite`, existing `@nutrition-tracker/nutrition-engine`, Vitest, pnpm workspaces, the current hand-written HTTP API, and React client API typings.

**Spec:** `plan/nutrition_tracker_tech_manual_2026-09-08/IMPLEMENTATION_ROADMAP.md` M3-002, `plan/nutrition_tracker_tech_manual_2026-09-08/ADR-0002-recipe-snapshot.md`, `plan/nutrition_tracker_tech_manual_2026-09-08/API_SPEC.md` section 12, `plan/nutrition_tracker_tech_manual_2026-09-08/DATABASE_SCHEMA.md` section 10, and `plan/nutrition_tracker_tech_manual_2026-09-08/NUTRITION_ENGINE_SPEC.md`.

## Global Constraints

- Ingredient nutrition snapshots are written at create or explicit refresh; `food_id` is a one-way source projection and never a real-time join.
- `recipe_calc_version` is exactly `recipe_yield_v1`; cache rows are derived, invalidatable, and rebuildable from stored recipe snapshots.
- Unknown, trace, and estimated statuses remain observable; unknown values are never silently converted into known zero values.
- Cooked weight is required for `per100g`; serving count is required for `perServing`; invalid or zero denominators return a typed validation error.
- Recipe mutations use one SQLite transaction, user scope, soft delete, and optimistic `version`; stale versions return `RECIPE_VERSION_CONFLICT`.
- Adding a recipe to a diary writes `diary_entry` plus `diary_entry_nutrient` snapshots through the diary application service; later food or recipe edits cannot change the historical entry.
- All new migrations are forward-only, included in API startup order, and tested on an empty database and an existing migrated database.
- All implementation follows TDD: write the focused failing test, observe RED, implement the minimum, run the focused test, then run the repository gates.
- No real passwords, cookies, API keys, or raw private prompts may appear in fixtures, tests, docs, logs, or commits.

---

### Task 1: Recipe schema migration and workspace package scaffold

**Files:**
- Create: `packages/recipe/package.json`
- Create: `packages/recipe/tsconfig.json`
- Create: `packages/recipe/src/index.ts`
- Create: `packages/recipe/test/recipe.test.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/test/schema.test.ts`
- Modify: `tsconfig.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Produces `RECIPE_MIGRATIONS` with migration version `0011_recipe_snapshots`.
- `recipe` has `id`, `user_id`, `name`, nullable `cooked_weight_g`, nullable `serving_count`, nullable `note`, positive `version`, nullable `deleted_at`, `created_at`, and `updated_at`.
- `recipe_ingredient` has `id`, `recipe_id`, nullable `food_id` (`ON DELETE SET NULL`), `name_snapshot`, positive `input_amount`, `input_unit` (`g|ml|serving`), nullable positive `gram_equivalent`, and non-negative `sort_order`.
- `recipe_ingredient_nutrient_snapshot` has `id`, `ingredient_id`, `nutrient_id`, nullable `amount_numeric`, nullable `amount_raw`, `value_status` (`known|trace|unknown|not_applicable|estimated`), `source_basis_json`, `nutrition_engine_version`, and `created_at`; its primary key is `id` and it is deleted with its ingredient.
- `recipe_nutrient_cache` has `(recipe_id,nutrient_id)` primary key, nullable `total_amount`, nullable `per_100g_amount`, nullable `per_serving_amount`, `computed_at`, `calc_version`, and nullable `invalidated_at`.
- API startup applies `...BODY_MIGRATIONS, ...RECIPE_MIGRATIONS` exactly once through the existing migration runner.

- [ ] **Step 1: Write the failing migration tests**

Add assertions in `packages/db/test/schema.test.ts` that apply all startup migrations to an empty SQLite database, verify all four recipe tables, recipe soft-delete/version columns, the ingredient snapshot status check, the cache composite primary key, and foreign-key enforcement. Add a repeat-apply assertion that returns no newly applied versions and leaves existing diary/food rows untouched.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```text
pnpm exec vitest run packages/db/test/schema.test.ts packages/recipe/test/recipe.test.ts
```

Expected: FAIL because `RECIPE_MIGRATIONS` and the package do not exist.

- [ ] **Step 3: Implement the migration and package scaffold**

Add the SQL tables and indexes (`recipe_user_updated_idx`, `recipe_ingredient_recipe_order_idx`, `recipe_snapshot_ingredient_idx`, and `recipe_cache_invalidated_idx`), export the migration list, add the package reference and workspace dependency, and export `RECIPE_CALC_VERSION = "recipe_yield_v1"` plus `RecipeError` from the package entry point. Do not add business behavior in this task.

- [ ] **Step 4: Run the focused schema tests and typecheck**

Run `pnpm exec vitest run packages/db/test/schema.test.ts` and `pnpm typecheck`; expected result is green migration coverage and a compiling package scaffold.

- [ ] **Step 5: Commit**

```text
git add packages/db/src/schema.ts packages/db/test/schema.test.ts packages/recipe apps/api/src/index.ts tsconfig.json pnpm-lock.yaml
git commit -m "feat: add recipe snapshot schema"
```

### Task 2: Pure recipe yield calculation and warnings

**Files:**
- Modify: `packages/recipe/src/index.ts`
- Modify: `packages/recipe/test/recipe.test.ts`
- Modify: `packages/nutrition-engine/src/index.ts` only if a shared typed helper is required by a failing test; otherwise leave it unchanged.
- Test: `packages/nutrition-engine/test/nutrition-engine.test.ts` when a shared helper is changed.

**Interfaces:**
- `RecipeIngredientSnapshot = { ingredientId: string; gramEquivalent: number; nutrients: Record<string, { amountNumeric: number | null; valueStatus: NutrientStatus | "not_applicable"; amountRaw: string | null }> }`.
- `RecipeCalculationInput = { ingredients: readonly RecipeIngredientSnapshot[]; cookedWeightG: number | null; servingCount: number | null }`.
- `RecipeCalculation = { calcVersion: "recipe_yield_v1"; total: Record<string, NutrientSummary>; per100g: Record<string, NutrientSummary> | null; perServing: Record<string, NutrientSummary> | null; warnings: RecipeWarning[] }`.
- `RecipeWarning = { code: "COOKED_WEIGHT_MISSING" | "SERVING_COUNT_MISSING" | "NUTRIENT_COVERAGE_INCOMPLETE" | "NUTRIENT_TRACE" | "NUTRIENT_ESTIMATED" | "NUTRIENT_UNKNOWN"; nutrientId?: string; ingredientId?: string }`.
- `calculateRecipe(input: RecipeCalculationInput): RecipeCalculation` is pure and never reads SQLite, environment variables, network, or system time.

- [ ] **Step 1: Write failing golden calculation tests**

Cover a 1,000 kcal / 500 g recipe yielding exactly 200 kcal per 100 g and 500 kcal per serving for two servings; total macro summation; missing cooked weight and missing serving count warnings; zero/negative cooked weight and serving count rejection; trace/estimated/unknown status propagation; and incomplete coverage based on known relevant grams.

Use this fixture shape so later persistence tests can reuse it:

```ts
const ingredients = [
  { ingredientId: "egg", gramEquivalent: 200, nutrients: { energy_kcal: { amountNumeric: 500, valueStatus: "known", amountRaw: "500" } } },
  { ingredientId: "oil", gramEquivalent: 50, nutrients: { energy_kcal: { amountNumeric: 500, valueStatus: "estimated", amountRaw: "500" } } },
] as const;
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run `pnpm exec vitest run packages/recipe/test/recipe.test.ts`; expected: FAIL because `calculateRecipe` is not implemented.

- [ ] **Step 3: Implement the minimum deterministic calculator**

Aggregate numeric amounts without changing status semantics; compute coverage as `known relevant grams / total relevant grams`; emit one warning per affected nutrient/status; compute `per100g` only when `cookedWeightG > 0` and `perServing` only when `servingCount > 0`; preserve `calcVersion: "recipe_yield_v1"`. Use the existing `NutrientSummary` shape so the API can return the same status metadata as diary/dashboard.

- [ ] **Step 4: Run focused calculator tests and existing nutrition tests**

Run `pnpm exec vitest run packages/recipe/test/recipe.test.ts packages/nutrition-engine/test/nutrition-engine.test.ts`; expected: all calculation and regression tests pass.

- [ ] **Step 5: Commit**

```text
git add packages/recipe/src/index.ts packages/recipe/test/recipe.test.ts packages/nutrition-engine
git commit -m "feat: add deterministic recipe yield calculator"
```

### Task 3: Recipe persistence, snapshot refresh, cache, copy, and versioning

**Files:**
- Modify: `packages/recipe/src/index.ts`
- Modify: `packages/recipe/test/recipe.test.ts`
- Test: `packages/db/test/schema.test.ts` for recipe foreign-key and cache invalidation assertions.

**Interfaces:**
- `RecipeIngredientInput = { foodId: string; amount: number; unit: "g" | "ml" | "serving"; servingId?: string | null }`.
- `RecipeCreateInput = { userId: string; name: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients: readonly RecipeIngredientInput[] }`.
- `RecipeUpdateInput = { userId: string; recipeId: string; version: number; name?: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients?: readonly RecipeIngredientInput[] }`.
- `RecipeService` exposes `create`, `get`, `list`, `update`, `copy`, `delete`, and `refreshIngredients`; each returned recipe includes ingredients, source/snapshot metadata, total/per100g/perServing, warnings, `calcVersion`, `version`, and `deletedAt`.
- `createRecipeService(sqlite, options?: { now?: () => number; id?: () => string })` resolves food data in the same transaction using the active primary source and `convertPortionToGrams`; it throws `RECIPE_FOOD_NOT_FOUND`, `RECIPE_SERVING_NOT_FOUND`, `RECIPE_PORTION_UNSUPPORTED`, `RECIPE_NUTRIENT_BASIS_UNSUPPORTED`, `RECIPE_INVALID_INPUT`, `RECIPE_NOT_FOUND`, or `RECIPE_VERSION_CONFLICT` as applicable.

- [ ] **Step 1: Write failing service tests**

Add a SQLite fixture with one active food, primary 100 g nutrient rows, and a serving. Test create writes the recipe, ingredient projection, one snapshot row per nutrient, and the calculation. Test a food nutrient update changes a new recipe but not the old recipe. Test explicit refresh replaces the selected ingredient snapshot and invalidates the cache. Test an unresolvable refresh preserves the old snapshot and returns a warning. Test update with a stale version rejects with `RECIPE_VERSION_CONFLICT`; test delete hides the recipe but does not remove diary history; test copy creates a new id with independent ingredient/snapshot rows.

- [ ] **Step 2: Run the focused tests and verify RED**

Run `pnpm exec vitest run packages/recipe/test/recipe.test.ts`; expected: FAIL because service methods do not exist.

- [ ] **Step 3: Implement source resolution and transactional writes**

Read only `food_item.active=1` and `food_source_record.is_primary=1`; calculate gram equivalents from g/ml/serving inputs; write `name_snapshot`, source metadata, scaled numeric amounts, raw values, statuses, and `NUTRITION_ENGINE_VERSION` in one `BEGIN IMMEDIATE` transaction. Replace the complete ingredient set when `ingredients` is supplied, mark all cache rows `invalidated_at`, and increment recipe `version` once.

- [ ] **Step 4: Implement lazy cache rebuild and explicit refresh**

On `get`/`list`, calculate from stored snapshots and upsert cache rows with `calc_version`, `computed_at`, and null `invalidated_at`. `refreshIngredients` accepts an optional ingredient id list; successful resolutions replace only those snapshots, failed resolutions retain old snapshots and add `RECIPE_INGREDIENT_REFRESH_UNAVAILABLE` warnings, while a new ingredient without a valid snapshot rejects the transaction.

- [ ] **Step 5: Run focused tests, typecheck, and commit**

Run `pnpm exec vitest run packages/recipe/test/recipe.test.ts && pnpm typecheck`; expected: all service tests pass and the workspace compiles.

```text
git add packages/recipe/src/index.ts packages/recipe/test/recipe.test.ts packages/db/test/schema.test.ts
git commit -m "feat: persist recipe snapshots and cache"
```

### Task 4: Recipe snapshot writer in the diary application service

**Files:**
- Modify: `packages/diary/src/index.ts`
- Modify: `packages/diary/test/diary.test.ts`
- Modify: `packages/recipe/src/index.ts`
- Modify: `packages/recipe/test/recipe.test.ts`

**Interfaces:**
- Add `RecipeDiarySnapshotInput = { userId: string; date: string; mealSlotId: string; recipeId: string; recipeName: string; amount: number; unit: "g"; gramEquivalent: number; sourceSnapshot: string; nutrients: Nutrient[]; note?: string | null }` to the diary package.
- `createDiaryService(sqlite).createRecipeSnapshotEntry(input): Entry` writes `diary_entry.recipe_id`, `display_name_snapshot`, `source_snapshot`, `entry_source="manual"`, and all supplied `diary_entry_nutrient` rows transactionally; the non-null `recipe_id` distinguishes the source without expanding the existing entry-source check constraint.
- `createRecipeService` receives an optional `diary?: Pick<ReturnType<typeof createDiaryService>, "createRecipeSnapshotEntry">`; `addToDiary` calls it with the recipe’s current calculated values and never re-reads food values during the diary write.

- [ ] **Step 1: Write failing diary and recipe integration tests**

Create a recipe, add 165 g to a dinner slot, assert the diary entry has `recipe_id` and copied nutrient amounts, then update the recipe and food values and assert the existing diary nutrient rows remain byte-for-byte unchanged. Test invalid date/meal slot/amount errors and transaction rollback when a nutrient row cannot be written.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm exec vitest run packages/diary/test/diary.test.ts packages/recipe/test/recipe.test.ts`; expected: FAIL because the recipe snapshot writer and `addToDiary` are absent.

- [ ] **Step 3: Implement the diary writer and recipe bridge**

Reuse diary’s existing date/day/meal-slot helpers and hydration shape, insert the recipe entry plus nutrient snapshots under one transaction, and pass a serialized `sourceSnapshot` containing recipe id, recipe calculation version, ingredient snapshot ids, and gram amount. Do not modify existing manual-food snapshot behavior.

- [ ] **Step 4: Run focused integration tests and commit**

Run the same focused command and `pnpm typecheck`; expected: snapshot immutability and rollback tests pass.

```text
git add packages/diary/src/index.ts packages/diary/test/diary.test.ts packages/recipe/src/index.ts packages/recipe/test/recipe.test.ts
git commit -m "feat: add recipe to diary snapshots"
```

### Task 5: Authenticated recipe HTTP API and typed web client

**Files:**
- Create: `apps/api/test/recipe-routes.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/test/api.test.ts`
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/API_SPEC.md`

**Interfaces:**
- Public authenticated routes: `GET /api/v1/recipes`, `POST /api/v1/recipes`, `GET /api/v1/recipes/:id`, `PATCH /api/v1/recipes/:id`, `DELETE /api/v1/recipes/:id`, `POST /api/v1/recipes/:id/copy`, `POST /api/v1/recipes/:id/refresh-ingredients`, and `POST /api/v1/recipes/:id/add-to-diary`.
- List query supports `includeDeleted=false` only for future maintenance use; normal responses exclude soft-deleted rows and are user scoped.
- `POST /recipes/:id/add-to-diary` accepts `{date,mealSlotId,amount,unit:"g"}` and returns the created diary entry with `201`.
- Recipe errors map to the existing `{error:{code,message,requestId}}` envelope: not-found codes are `404`, version conflicts and refresh conflicts are `409`, validation/source errors are `400`.
- `apps/web/src/api.ts` exports `getRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `copyRecipe`, `deleteRecipe`, `refreshRecipeIngredients`, and `addRecipeToDiary`, all using `credentials: "include"` and the existing response unwrapping.

- [ ] **Step 1: Write failing route/client tests**

Add route tests that bootstrap/login a user, create a recipe from fixture foods, read it, copy it, update it with the returned version, reject a stale version, explicitly refresh after a food update, add it to diary, delete it, and verify another user receives `404`. Add client tests for URL encoding, credentials inclusion, and `204`/JSON behavior.

- [ ] **Step 2: Run focused HTTP tests and verify RED**

Run `pnpm exec vitest run apps/api/test/recipe-routes.test.ts apps/web/test/api.test.ts`; expected: FAIL because recipe service wiring and routes do not exist.

- [ ] **Step 3: Wire migrations, service, error mapping, and routes**

Import `RECIPE_MIGRATIONS`, `createRecipeService`, and `RecipeError`; construct the service after food/diary services so `addToDiary` receives the diary writer. Add route regexes before the SPA fallback, pass only the authenticated `userId`, validate route body fields before calling the service, and keep all error responses in the existing envelope.

- [ ] **Step 4: Add typed web client methods and update API spec**

Define the recipe DTOs from the service contract, ensure mutation methods send JSON and credentials, and document request/response bodies, version conflict, soft delete, explicit refresh warnings, and diary snapshot guarantees in section 12.

- [ ] **Step 5: Run focused route/client tests and commit**

Run `pnpm exec vitest run apps/api/test/recipe-routes.test.ts apps/web/test/api.test.ts && pnpm lint && pnpm typecheck`.

```text
git add apps/api/src/index.ts apps/api/test/recipe-routes.test.ts apps/api/package.json apps/web/src/api.ts apps/web/test/api.test.ts plan/nutrition_tracker_tech_manual_2026-09-08/API_SPEC.md
git commit -m "feat: expose recipe calculation api"
```

### Task 6: Documentation, integration gate, and handoff evidence

**Files:**
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DATABASE_SCHEMA.md`
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/README.md`
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md`
- Test: existing repository test suites and `e2e/dashboard.spec.ts` only if the recipe API contract requires a regression fixture; M3-003 owns recipe UI/E2E.

**Interfaces:**
- Documentation matches the implemented migration column names, cache invalidation rules, API routes, and `recipe_yield_v1` version.
- `DEVELOPMENT_PROGRESS.md` records M3-002 acceptance evidence and leaves M3-003 as the next planned task; no M3-002 claim is made without every command passing.

- [ ] **Step 1: Add migration/API documentation checks**

Verify the README reading order links ADR-0002 and this implementation plan, the database recipe tables match the migration, and API section 12 names every route and error code. Add no secrets or example passwords.

- [ ] **Step 2: Run the complete acceptance gate**

Run each command separately and record exit code plus key result in `DEVELOPMENT_PROGRESS.md`:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm api:smoke
pnpm test:e2e
git diff --check
```

Expected: all commands exit 0; full Vitest includes recipe calculation/service/API tests; Playwright remains green for the existing M1/M2 flow. If Docker CLI is unavailable, record only that environment limitation and do not claim a local Docker smoke pass.

- [ ] **Step 3: Record M3-002 completion evidence**

Update task status to `DONE`, add the exact timestamp in `Asia/Shanghai`, changed files, acceptance commands and key results, update M3 count from `1/6` to `2/6`, set current focus to M3-003 recipe UI/E2E, and add an activity-log entry and handoff summary covering snapshot immutability, explicit refresh, cache rebuild, optimistic versioning, copy/delete, and recipe-to-diary history.

- [ ] **Step 4: Commit documentation and final handoff**

```text
git add plan/nutrition_tracker_tech_manual_2026-09-08/DATABASE_SCHEMA.md plan/nutrition_tracker_tech_manual_2026-09-08/README.md plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md
git commit -m "docs: record recipe api acceptance evidence"
```

The next implementer must read `DEVELOPMENT_PROGRESS.md`, `ADR-0002-recipe-snapshot.md`, and this plan before starting M3-003; M3-003 must not reimplement recipe calculation or change snapshot semantics.

---

## Self-review

- Spec coverage: M3-002 total/per100g/perServing and cooked yield are covered by Task 2; persistence, refresh, cache, copy, edit, delete by Task 3; recipe-to-diary snapshot immutability by Task 4; authenticated HTTP contracts by Task 5; migration and handoff evidence by Tasks 1 and 6.
- Placeholder scan: no unresolved placeholder markers or unspecified edge-case steps remain; every task names concrete files, interfaces, tests, and commands.
- Type consistency: `RecipeCalculation`, `RecipeWarning`, `RecipeIngredientInput`, `RecipeCreateInput`, `RecipeUpdateInput`, and `RecipeDiarySnapshotInput` are defined before downstream tasks consume them; API client method names match the listed routes.
