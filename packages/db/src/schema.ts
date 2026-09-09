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

export const FOOD_MIGRATIONS: readonly SqliteMigration[] = [
  {
    version: "0002_food_canonical_schema",
    sql: `
      CREATE TABLE food_dataset (
        id TEXT PRIMARY KEY,
        dataset_key TEXT NOT NULL CHECK (length(trim(dataset_key)) > 0),
        version TEXT NOT NULL CHECK (length(trim(version)) > 0),
        source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
        source_url TEXT,
        source_notes TEXT,
        checksum TEXT NOT NULL CHECK (length(trim(checksum)) > 0),
        imported_at INTEGER NOT NULL,
        promoted_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('staging', 'active', 'archived', 'failed')),
        record_count INTEGER NOT NULL CHECK (record_count >= 0),
        validation_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE INDEX food_dataset_key_version_idx ON food_dataset(dataset_key, version);
      CREATE UNIQUE INDEX food_dataset_one_active_key_idx
        ON food_dataset(dataset_key) WHERE status = 'active';
      CREATE TRIGGER food_dataset_reject_active_delete
        BEFORE DELETE ON food_dataset
        WHEN OLD.status = 'active'
      BEGIN
        SELECT RAISE(ABORT, 'ACTIVE_FOOD_DATASET_DELETE_FORBIDDEN');
      END;

      CREATE TABLE food_category (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES food_category(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
        source_dataset_id TEXT REFERENCES food_dataset(id) ON DELETE RESTRICT
      );

      CREATE TABLE food_item (
        id TEXT PRIMARY KEY,
        canonical_key TEXT NOT NULL UNIQUE CHECK (length(trim(canonical_key)) > 0),
        primary_name TEXT NOT NULL CHECK (length(trim(primary_name)) > 0),
        english_name TEXT,
        brand TEXT,
        food_code TEXT,
        category_id TEXT REFERENCES food_category(id) ON DELETE RESTRICT,
        food_type TEXT NOT NULL CHECK (food_type IN ('generic', 'branded', 'recipe', 'custom')),
        default_basis TEXT NOT NULL CHECK (default_basis IN ('edible_100g', 'liquid_100ml', 'serving')),
        edible_ratio REAL CHECK (edible_ratio IS NULL OR edible_ratio BETWEEN 0 AND 1),
        density_g_ml REAL CHECK (density_g_ml IS NULL OR density_g_ml > 0),
        source_quality TEXT NOT NULL CHECK (source_quality IN ('A', 'B', 'C', 'D')),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX food_item_food_code_idx ON food_item(food_code);

      CREATE TABLE food_source_record (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES food_item(id) ON DELETE RESTRICT,
        dataset_id TEXT REFERENCES food_dataset(id) ON DELETE RESTRICT,
        source_type TEXT NOT NULL CHECK (source_type IN ('cfcd6', 'user_label', 'custom', 'off', 'usda', 'ai_ocr_candidate')),
        source_record_id TEXT,
        raw_json TEXT NOT NULL,
        source_url TEXT,
        imported_at INTEGER NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        CHECK (NOT (source_type = 'ai_ocr_candidate' AND is_primary = 1)),
        UNIQUE(id, food_id)
      );

      CREATE INDEX food_source_record_food_idx ON food_source_record(food_id);

      CREATE TABLE food_nutrient_definition (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
        unit TEXT NOT NULL CHECK (unit IN ('kcal', 'g', 'mg', 'µg')),
        nutrient_group TEXT NOT NULL CHECK (nutrient_group IN ('macro', 'vitamin', 'mineral', 'other')),
        display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
        summable INTEGER NOT NULL DEFAULT 1 CHECK (summable IN (0, 1))
      );

      CREATE TABLE food_nutrient_value (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES food_item(id) ON DELETE RESTRICT,
        source_record_id TEXT NOT NULL,
        nutrient_id TEXT NOT NULL REFERENCES food_nutrient_definition(id) ON DELETE RESTRICT,
        amount_numeric REAL,
        amount_raw TEXT,
        value_status TEXT NOT NULL CHECK (value_status IN ('known', 'trace', 'unknown', 'not_applicable', 'estimated')),
        basis_amount REAL NOT NULL CHECK (basis_amount > 0),
        basis_unit TEXT NOT NULL CHECK (basis_unit IN ('g', 'ml', 'serving')),
        confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
        created_at INTEGER NOT NULL,
        UNIQUE(food_id, source_record_id, nutrient_id),
        FOREIGN KEY (source_record_id, food_id)
          REFERENCES food_source_record(id, food_id) ON DELETE RESTRICT
      );

      CREATE INDEX food_nutrient_value_food_idx ON food_nutrient_value(food_id, nutrient_id);

      CREATE TABLE food_alias (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES food_item(id) ON DELETE RESTRICT,
        alias TEXT NOT NULL CHECK (length(trim(alias)) > 0),
        alias_normalized TEXT NOT NULL CHECK (length(trim(alias_normalized)) > 0),
        alias_type TEXT NOT NULL CHECK (alias_type IN ('synonym', 'regional', 'pinyin', 'abbreviation', 'english')),
        user_defined INTEGER NOT NULL DEFAULT 0 CHECK (user_defined IN (0, 1))
      );

      CREATE INDEX food_alias_normalized_idx ON food_alias(alias_normalized);

      CREATE TABLE food_serving (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES food_item(id) ON DELETE RESTRICT,
        label TEXT NOT NULL CHECK (length(trim(label)) > 0),
        amount REAL NOT NULL CHECK (amount > 0),
        unit TEXT NOT NULL CHECK (unit IN ('g', 'ml')),
        equivalent_g REAL CHECK (equivalent_g IS NULL OR equivalent_g > 0),
        equivalent_ml REAL CHECK (equivalent_ml IS NULL OR equivalent_ml > 0),
        sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
        source TEXT NOT NULL CHECK (source IN ('built_in', 'user')),
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
      );

      CREATE TABLE food_search_stats (
        food_id TEXT PRIMARY KEY REFERENCES food_item(id) ON DELETE RESTRICT,
        use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
        last_used_at INTEGER,
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
        recent_score REAL NOT NULL DEFAULT 0 CHECK (recent_score >= 0)
      );

      CREATE TABLE food_staging_dataset (
        id TEXT PRIMARY KEY,
        dataset_key TEXT NOT NULL CHECK (length(trim(dataset_key)) > 0),
        version TEXT NOT NULL CHECK (length(trim(version)) > 0),
        source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
        checksum TEXT NOT NULL CHECK (length(trim(checksum)) > 0),
        imported_at INTEGER NOT NULL,
        raw_manifest_json TEXT NOT NULL
      );

      CREATE TABLE food_staging_item (
        id TEXT PRIMARY KEY,
        staging_dataset_id TEXT NOT NULL REFERENCES food_staging_dataset(id) ON DELETE RESTRICT,
        source_record_id TEXT,
        raw_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(id, staging_dataset_id)
      );

      CREATE INDEX food_staging_item_dataset_idx ON food_staging_item(staging_dataset_id);

      CREATE TABLE food_staging_nutrient (
        id TEXT PRIMARY KEY,
        staging_dataset_id TEXT NOT NULL REFERENCES food_staging_dataset(id) ON DELETE RESTRICT,
        staging_item_id TEXT NOT NULL,
        nutrient_key TEXT NOT NULL CHECK (length(trim(nutrient_key)) > 0),
        amount_raw TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (staging_item_id, staging_dataset_id)
          REFERENCES food_staging_item(id, staging_dataset_id) ON DELETE RESTRICT
      );

      CREATE INDEX food_staging_nutrient_item_idx ON food_staging_nutrient(staging_item_id);

      CREATE VIRTUAL TABLE food_search_fts USING fts5(
        food_id UNINDEXED,
        primary_name,
        aliases,
        english_name,
        pinyin,
        brand,
        tokenize = 'unicode61'
      );
    `,
  },
  {
    version: "0003_food_staging_validation",
    sql: `
      ALTER TABLE food_staging_dataset ADD COLUMN status TEXT NOT NULL DEFAULT 'staged'
        CHECK (status IN ('staged', 'validated', 'failed', 'promoted'));
      ALTER TABLE food_staging_dataset ADD COLUMN validation_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE food_staging_dataset ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
      CREATE UNIQUE INDEX food_staging_dataset_identity_idx
        ON food_staging_dataset(dataset_key, version, checksum);
    `,
  },
  {
    version: "0004_food_import_review_fixes",
    sql: `
      ALTER TABLE food_source_record ADD COLUMN source_notes TEXT;

      PRAGMA defer_foreign_keys = ON;
      DROP INDEX food_nutrient_value_food_idx;
      ALTER TABLE food_nutrient_value RENAME TO food_nutrient_value_legacy;
      ALTER TABLE food_nutrient_definition RENAME TO food_nutrient_definition_legacy;

      CREATE TABLE food_nutrient_definition (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
        unit TEXT NOT NULL CHECK (unit IN ('kcal', 'kJ', 'g', 'mg', 'µg')),
        nutrient_group TEXT NOT NULL CHECK (nutrient_group IN ('macro', 'vitamin', 'mineral', 'other')),
        display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
        summable INTEGER NOT NULL DEFAULT 1 CHECK (summable IN (0, 1))
      );

      CREATE TABLE food_nutrient_value (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES food_item(id) ON DELETE RESTRICT,
        source_record_id TEXT NOT NULL,
        nutrient_id TEXT NOT NULL REFERENCES food_nutrient_definition(id) ON DELETE RESTRICT,
        amount_numeric REAL,
        amount_raw TEXT,
        value_status TEXT NOT NULL CHECK (value_status IN ('known', 'trace', 'unknown', 'not_applicable', 'estimated')),
        basis_amount REAL NOT NULL CHECK (basis_amount > 0),
        basis_unit TEXT NOT NULL CHECK (basis_unit IN ('g', 'ml', 'serving')),
        confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
        created_at INTEGER NOT NULL,
        UNIQUE(food_id, source_record_id, nutrient_id),
        FOREIGN KEY (source_record_id, food_id)
          REFERENCES food_source_record(id, food_id) ON DELETE RESTRICT
      );

      INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable)
        SELECT id, display_name, unit, nutrient_group, display_order, summable
        FROM food_nutrient_definition_legacy;
      INSERT INTO food_nutrient_value (id, food_id, source_record_id, nutrient_id, amount_numeric, amount_raw, value_status, basis_amount, basis_unit, confidence, created_at)
        SELECT id, food_id, source_record_id, nutrient_id, amount_numeric, amount_raw, value_status, basis_amount, basis_unit, confidence, created_at
        FROM food_nutrient_value_legacy;
      DROP TABLE food_nutrient_value_legacy;
      DROP TABLE food_nutrient_definition_legacy;
      CREATE INDEX food_nutrient_value_food_idx ON food_nutrient_value(food_id, nutrient_id);
    `,
  },
  {
    version: "0005_food_search_key",
    sql: `
      ALTER TABLE food_item ADD COLUMN search_key TEXT NOT NULL DEFAULT '';
      UPDATE food_item SET search_key = lower(primary_name) WHERE search_key = '';
      CREATE INDEX food_item_search_key_idx ON food_item(search_key);
    `,
  },
  {
    version: "0006_food_search_key_nocase_index",
    sql: `
      CREATE INDEX food_item_search_key_nocase_idx ON food_item(search_key COLLATE NOCASE);
    `,
  },
];

export const DIARY_MIGRATIONS: readonly SqliteMigration[] = [
  {
    version: "0007_diary_snapshots",
    sql: `
      CREATE TABLE diary_day (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profile_user(id) ON DELETE RESTRICT,
        local_date TEXT NOT NULL CHECK (local_date GLOB '????-??-??'),
        goal_id TEXT REFERENCES profile_nutrition_goal(id) ON DELETE SET NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, local_date)
      );
      CREATE INDEX diary_day_user_date_idx ON diary_day(user_id, local_date);

      CREATE TABLE diary_meal_slot (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profile_user(id) ON DELETE CASCADE,
        key TEXT NOT NULL CHECK (key IN ('breakfast', 'lunch', 'dinner', 'snack')),
        display_name TEXT NOT NULL,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        UNIQUE(user_id, key)
      );

      CREATE TABLE diary_entry (
        id TEXT PRIMARY KEY,
        diary_day_id TEXT NOT NULL REFERENCES diary_day(id) ON DELETE CASCADE,
        meal_slot_id TEXT NOT NULL REFERENCES diary_meal_slot(id) ON DELETE RESTRICT,
        food_id TEXT REFERENCES food_item(id) ON DELETE SET NULL,
        recipe_id TEXT,
        display_name_snapshot TEXT NOT NULL,
        source_snapshot TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'serving')),
        gram_equivalent REAL CHECK (gram_equivalent IS NULL OR gram_equivalent > 0),
        serving_label_snapshot TEXT,
        note TEXT,
        entry_source TEXT NOT NULL CHECK (entry_source IN ('manual', 'ai_confirmed', 'copy', 'copy_snapshot', 'import')),
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX diary_entry_day_meal_idx ON diary_entry(diary_day_id, meal_slot_id, created_at);

      CREATE TABLE diary_entry_nutrient (
        entry_id TEXT NOT NULL REFERENCES diary_entry(id) ON DELETE CASCADE,
        nutrient_id TEXT NOT NULL REFERENCES food_nutrient_definition(id) ON DELETE RESTRICT,
        amount_numeric REAL,
        amount_raw TEXT,
        value_status TEXT NOT NULL CHECK (value_status IN ('known', 'trace', 'unknown', 'not_applicable', 'estimated')),
        source_basis_json TEXT NOT NULL,
        PRIMARY KEY(entry_id, nutrient_id)
      );
    `,
  },
  {
    version: "0008_diary_serving_identity",
    sql: `
      ALTER TABLE diary_entry ADD COLUMN serving_id TEXT REFERENCES food_serving(id) ON DELETE SET NULL;
    `,
  },
];
