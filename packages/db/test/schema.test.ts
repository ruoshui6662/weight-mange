import { describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../src/index.js";
import { ANALYTICS_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "../src/schema.js";

describe("core/profile schema baseline", () => {
  it("creates the required tables from an empty database", () => {
    const { sqlite } = openDatabase(":memory:");

    expect(applyMigrations(sqlite, CORE_MIGRATIONS, { now: () => 1000 })).toEqual({
      applied: ["0001_core_profile"],
    });
    expect(
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('core_settings', 'core_session', 'core_idempotency_key', 'core_job_run', 'profile_user', 'profile_body_profile', 'profile_nutrition_goal') ORDER BY name",
        )
        .all(),
    ).toEqual([
      { name: "core_idempotency_key" },
      { name: "core_job_run" },
      { name: "core_session" },
      { name: "core_settings" },
      { name: "profile_body_profile" },
      { name: "profile_nutrition_goal" },
      { name: "profile_user" },
    ]);
  });

  it("enforces profile references and one active nutrition goal", () => {
    const { sqlite } = openDatabase(":memory:");
    applyMigrations(sqlite, CORE_MIGRATIONS, { now: () => 1000 });

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO core_session (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run("session_1", "missing_user", "hash_1", 2000, 1000, 1000),
    ).toThrow();

    sqlite
      .prepare(
        "INSERT INTO profile_user (id, display_name, timezone, unit_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("user_1", "Test", "Asia/Shanghai", "metric", 1000, 1000);
    sqlite
      .prepare(
        "INSERT INTO profile_nutrition_goal (id, user_id, effective_from, goal_type, calorie_target_kcal, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("goal_1", "user_1", "2026-01-01", "maintain", 2000, "manual", 1000);

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO profile_nutrition_goal (id, user_id, effective_from, goal_type, calorie_target_kcal, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("goal_2", "user_1", "2026-02-01", "loss", 1800, "manual", 2000),
    ).toThrow();
  });

  it("adds an analytics daily summary keyed by user and local date", () => {
    const { sqlite } = openDatabase(":memory:");
    applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS]);
    expect(sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='analytics_daily_summary'").get()).toMatchObject({ sql: expect.stringContaining("PRIMARY KEY (user_id, local_date)") });
    expect(sqlite.prepare("PRAGMA table_info(analytics_daily_summary)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "calc_version" })]));
  });
});
