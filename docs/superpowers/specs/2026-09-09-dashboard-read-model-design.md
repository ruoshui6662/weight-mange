# M1-006 Dashboard read model design

## Goal

Expose one deterministic `GET /api/v1/dashboard/:date` read model that combines the stored diary nutrient snapshots with the goal effective for that diary date, while allowing the daily cache to be deleted and rebuilt without changing historical values.

## Scope

- Consume the existing `profile_nutrition_goal` rows; goal CRUD remains M2-001.
- Bind a diary day to the goal effective when the day row is first created through `diary_day.goal_id`.
- Add a versioned `analytics_daily_summary` cache keyed by `(user_id, local_date)`.
- Return intake, macro totals, per-nutrient coverage, meal totals, remaining calories, and explicit no-data exercise/weight fields.
- Do not read current food nutrient rows during dashboard aggregation; only `diary_entry_nutrient` snapshots are authoritative.

## Data flow

1. Diary day creation resolves the goal whose `effective_from <= local_date` and whose `effective_to` is null or after the date; its id is stored in `diary_day.goal_id`.
2. Dashboard reads the diary service's snapshot-derived daily and meal totals plus the bound goal.
3. Dashboard upserts `analytics_daily_summary` with the current calculation version and returns the same result envelope.
4. A missing cache row is rebuilt from snapshots; deleting the row therefore cannot alter the response.

## Contract

`getDashboard({ userId, date })` returns:

```ts
{
  date: string;
  goal: { kcal: number; proteinG: number | null; fatG: number | null; carbG: number | null; fiberG: number | null } | null;
  intake: { kcal: number; proteinG: number; fatG: number; carbG: number; fiberG: number | null };
  coverage: Record<string, { coverage: number; hasTrace: boolean; hasEstimated: boolean }>;
  exercise: { burnKcal: number; creditKcal: number; available: false };
  remainingKcal: number | null;
  meals: Array<{ key: string; totals: unknown }>;
}
```

Unknown/trace nutrient values remain zero in numeric sums but retain coverage metadata. If no goal exists, `goal` and `remainingKcal` are null. Exercise and weight are explicit no-data placeholders until their planned M2/M3 domains exist; no values are fabricated.

## Non-goals

No goal create/update endpoint, exercise calculation, weight trend, UI, external network call, or food re-calculation is included.

## Risks and decisions

- Existing diary reads create a day row when needed, so dashboard may safely ensure the day exists and snapshot the goal once.
- The cache stores only the fields defined by `DATABASE_SCHEMA.md`; the detailed coverage and meals remain reconstructable from diary snapshots.
- `calc_version` is a stable string and changes whenever aggregation semantics change.
