# M1-002 Food canonical schema — implementation report

## Status

`DONE` — 2026-09-09 18:10 +08:00.

## Changed files

- `packages/db/src/schema.ts`
  - Added forward-only `0002_food_canonical_schema` in separately exported `FOOD_MIGRATIONS` for later composition with `CORE_MIGRATIONS`.
  - Added canonical food catalog tables, raw source/nutrient preservation, partial active-dataset uniqueness, staging tables, indexes, checks, foreign keys, and `food_search_fts` FTS5 baseline using `unicode61`.
- `packages/db/test/food-schema.test.ts`
  - Added seven real SQLite migration/constraint tests.
- `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md`
  - Recorded task completion and verification evidence.

## TDD evidence

### RED

Command:

```text
pnpm vitest run packages/db/test/food-schema.test.ts
```

Exit code: `1`.

Result: 7/7 tests failed before production schema was written. The empty-database test received only `0001_core_profile` instead of the required `0002_food_canonical_schema`; all remaining tests failed because `food_dataset` did not exist. This demonstrated the missing migration, rather than a test setup or TypeScript error. A later focused RED also proved that an `ai_ocr_candidate` source could incorrectly be primary; the migration now rejects that state and rejects deletion of an active dataset.

### GREEN

Command:

```text
pnpm vitest run packages/db/test/food-schema.test.ts
```

Exit code: `0`.

Result: 1 test file, 7/7 tests passed. The tests cover empty-db migration/object creation; active dataset partial uniqueness and deletion protection; canonical key and food field checks; foreign-key, AI candidate, and deactivation semantics; raw `Tr`/`—` preservation and nutrient constraints; serving/alias/search-stat checks; and staging raw payload linkage.

## Full verification

All commands ran from `D:\AI编程\体重管理\.worktrees\m0-foundation`.

| Command | Exit | Result |
|---|---:|---|
| `pnpm lint` | 0 | ESLint completed without findings. |
| `pnpm typecheck` | 0 | TypeScript project build completed. |
| `pnpm test` | 0 | 8 test files, 35 tests passed. |
| `pnpm test:integration` | 0 | No integration test files found; configured command exits successfully. |
| `pnpm build` | 0 | TypeScript build completed. |
| `pnpm api:smoke` | 0 | `home=200`, `health=200`, `ready=200`. |
| `pnpm docker:smoke` | 0 | Script recorded that Docker CLI is unavailable in this environment. |

## Concerns

- The local Docker CLI is unavailable. `docker:smoke` is intentionally non-failing and records this condition; prior remote multi-architecture validation remains the available Docker evidence.
- This task deliberately provides schema only. M1-003 must implement parsing, semantic validation, dataset diff/promote transactions, and FTS synchronization without bypassing `food_staging_*`.

## Commit hashes

- Implementation commit: pending local commit.
