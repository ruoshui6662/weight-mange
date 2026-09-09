# M1-001 Nutrition Engine 基础 — Implementation Report

Status: DONE

## Changed files

- `packages/nutrition-engine/package.json` — workspace package definition.
- `packages/nutrition-engine/tsconfig.json` — composite TypeScript build config.
- `packages/nutrition-engine/src/index.ts` — pure scaling, portion conversion, status-aware aggregation, coverage, display rounding, and version contracts.
- `packages/nutrition-engine/test/nutrition-engine.test.ts` — golden and boundary tests.
- `tsconfig.json` — project reference for the new package.
- `pnpm-lock.yaml` — workspace importer entry.
- `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md` — completion and evidence record.

## Test-first evidence (RED)

Command: `pnpm test -- --run packages/nutrition-engine/test/nutrition-engine.test.ts`

Exit code: 1. Expected failure: Vitest could not resolve `../src/index.js` from the new nutrition-engine test. The desired public API and golden expectations had no implementation.

## Green evidence

Command: `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts`

Exit code: 0. Result: 1 test file passed; 6 tests passed. Coverage includes `223 × 75 / 100 = 167.25`, `0.91 × 5ml = 4.55g`, serving and edible portions, status-aware aggregation/coverage, and display-only rounding.

## Full verification

| Command | Exit | Result |
|---|---:|---|
| `pnpm lint` | 0 | ESLint passed. |
| `pnpm typecheck` | 0 | TypeScript project build check passed. |
| `pnpm test` | 0 | 7 test files, 28 tests passed. |
| `pnpm test:integration` | 0 | No integration files exist; configured to exit successfully. |
| `pnpm build` | 0 | TypeScript composite build passed. |
| `pnpm api:smoke` | 0 | `home=200`, `health=200`, `ready=200`. |
| `pnpm docker:smoke` | 0 | Docker CLI absent; smoke script reported the environment block without a false pass. |

## Concerns

- The host has no Docker CLI, so a real local container invocation was not possible. This is a known environment limitation; the required smoke command exited 0 while explicitly reporting it.
- M1-001 intentionally excludes recipe, BMR/TDEE, MET, adaptive-TDEE and diary snapshot behavior; their algorithm constants remain future-slice work.

## Commit hashes

- `d0e0ef1cbf4c45f7a18d9489808172d200570e73` — `feat: add nutrition engine foundation`

## Review fix: estimated values and known coverage

Review found that `sumNutrients` incorrectly treated `estimated` entries as known coverage. Per `NUTRITION_ENGINE_SPEC.md` section 8, coverage is `knownEntryWeight / relevantEntryWeight`; estimates still sum and set `hasEstimated`, but do not increase the coverage numerator.

### Test-first evidence (RED)

Changed the status-aware aggregation test to require this exact set of entries: known 100g, unknown 50g, trace 25g, estimated 25g. It asserts amount `10.42`, coverage `0.5`, `hasTrace: true`, and `hasEstimated: true`.

Command: `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts`

Exit code: 1. Expected failure observed: the assertion expected coverage `0.5` but received `0.625`.

### Green and relevant verification

| Command | Exit | Result |
|---|---:|---|
| `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts` | 0 | 1 test file, 6 tests passed. |
| `pnpm lint` | 0 | ESLint passed. |
| `pnpm typecheck` | 0 | TypeScript check passed. |
| `pnpm test` | 0 | 7 test files, 28 tests passed. |
| `pnpm build` | 0 | TypeScript composite build passed. |

### Review-fix commit

- `c413fd9d41ec4700cd7e1c9e23b058534652a004` — `fix: exclude estimates from known coverage`
