import type { SqliteMigration } from "./index.js";

export const CORE_MIGRATIONS: readonly SqliteMigration[] = [
  {
    version: "0001_core_profile",
    sql: `
      CREATE TABLE core_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 0 CHECK (encrypted IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE core_audit_log (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        module TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        payload_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE profile_user (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        password_hash TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        unit_system TEXT NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE core_session (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profile_user(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      );

      CREATE INDEX core_session_user_idx ON core_session(user_id, expires_at);

      CREATE TABLE core_idempotency_key (
        scope TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER,
        response_json TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (scope, idempotency_key)
      );

      CREATE TABLE core_job_run (
        job_key TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        error_json TEXT,
        PRIMARY KEY (job_key, scheduled_for)
      );

      CREATE TABLE profile_body_profile (
        user_id TEXT PRIMARY KEY REFERENCES profile_user(id) ON DELETE CASCADE,
        birth_date TEXT,
        sex_for_formula TEXT CHECK (sex_for_formula IN ('male', 'female', 'none')),
        height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
        activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'high', 'very_high')),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE profile_nutrition_goal (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profile_user(id) ON DELETE CASCADE,
        effective_from TEXT NOT NULL,
        effective_to TEXT,
        goal_type TEXT NOT NULL CHECK (goal_type IN ('maintain', 'loss', 'gain')),
        calorie_target_kcal REAL NOT NULL CHECK (calorie_target_kcal > 0),
        protein_target_g REAL CHECK (protein_target_g IS NULL OR protein_target_g >= 0),
        fat_target_g REAL CHECK (fat_target_g IS NULL OR fat_target_g >= 0),
        carb_target_g REAL CHECK (carb_target_g IS NULL OR carb_target_g >= 0),
        fiber_target_g REAL CHECK (fiber_target_g IS NULL OR fiber_target_g >= 0),
        source TEXT NOT NULL CHECK (source IN ('manual', 'formula', 'adaptive')),
        created_at INTEGER NOT NULL,
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
      );

      CREATE UNIQUE INDEX profile_one_active_goal_idx
        ON profile_nutrition_goal(user_id)
        WHERE effective_to IS NULL;
      CREATE INDEX profile_goal_period_idx
        ON profile_nutrition_goal(user_id, effective_from, effective_to);
    `,
  },
];
