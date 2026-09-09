# M1-005 Diary domain and snapshot — implementation report

Status: implementation complete; independent review pending.  
Completed: 2026-09-09 21:20 +08:00.

## RED

`pnpm vitest run packages/diary/test/diary.test.ts apps/api/test/diary-routes.test.ts`

- exit: 1
- domain suite could not resolve the absent diary package and API diary entry POST returned 404 instead of 201.
- The tests exercised immutable scaled nutrient snapshots, idempotent retry, stale version rejection, copy fallback for inactive food, transaction rollback, and API nested errors.

## GREEN

After building the workspace packages:

`pnpm vitest run packages/diary/test/diary.test.ts apps/api/test/diary-routes.test.ts`

- exit: 0
- result: 2 test files, 5 tests passed.

## Delivered

- Forward migration `0007_diary_snapshots` with day/meal/entry/nutrient snapshot tables, constraints, FKs and indexes.
- `@nutrition-tracker/diary` transactional domain using nutrition-engine scaling and source metadata snapshots.
- Core API routes for day read, entry create/update/delete and meal copy using the common nested error envelope.
- Immutable read totals from `diary_entry_nutrient`; no diary read recalculates current food rows.
- Copy uses active current food where available; inactive/missing food uses the old snapshot and `copy_snapshot`.

## Full verification

All exit 0:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` — 51 files, 250 tests passed
- `pnpm test:integration` — no integration files, exit 0
- `pnpm build`
- `pnpm api:smoke` — home/health/ready = 200
- `pnpm docker:smoke` — Docker CLI unavailable; script reports the environment condition and exits 0

## Scope and limitation

No recipes, photos, goal snapshots, dashboard cache, UI, AI, or network calls were added. The temporary core routes use `local-user`; later auth-aware routes must supply the session user id.

## Review remediation

Four Important findings were fixed after a new RED suite (missing `mealTotals`/`dailyTotal`, absent serving identity, and missing copy-day route):

- `0008_diary_serving_identity` persists `serving_id` forward-only.
- Day reads aggregate `diary_entry_nutrient` rows only, returning meal and daily totals with known-only coverage numerator, trace/unknown flags, and estimated markers.
- Active copy re-resolves its persisted serving; inactive/missing food preserves the stored entry and nutrient snapshot as `copy_snapshot`.
- `copyDay` and `POST /api/v1/diary/:date/copy-day` copy all source-day meal slots.

Focused remediation verification: `pnpm vitest run packages/diary/test/diary.test.ts apps/api/test/diary-routes.test.ts` — exit 0, 2 files / 7 tests. Full gates rerun: 51 files / 254 tests, all listed commands exit 0; Docker CLI remains unavailable locally.
