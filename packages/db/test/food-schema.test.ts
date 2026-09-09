import { describe, expect, it } from "vitest";

import { applyMigrations, openDatabase, type SqliteMigration } from "../src/index.js";
import * as schema from "../src/schema.js";

const FOOD_MIGRATIONS = (schema as { FOOD_MIGRATIONS?: readonly SqliteMigration[] }).FOOD_MIGRATIONS ?? [];
const migrations = [...schema.CORE_MIGRATIONS, ...FOOD_MIGRATIONS];

function createFood(sqlitePath = ":memory:") {
  const { sqlite } = openDatabase(sqlitePath);
  applyMigrations(sqlite, migrations, { now: () => 1000 });
  sqlite
    .prepare(
      "INSERT INTO food_dataset (id, dataset_key, version, source_name, checksum, imported_at, status, record_count, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run("dataset_1", "cfcd6-sanotsu", "v1", "CFCD", "checksum-1", 1000, "active", 1, "{}", "{}");
  sqlite
    .prepare(
      "INSERT INTO food_item (id, canonical_key, primary_name, food_type, default_basis, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run("food_1", "cfcd6:091101x", "鸡", "generic", "edible_100g", "A", 1, 1000, 1000);
  return sqlite;
}

describe("food canonical schema", () => {
  it("migrates an empty database and exposes every canonical, staging, and FTS object", () => {
    const { sqlite } = openDatabase(":memory:");

    expect(applyMigrations(sqlite, migrations, { now: () => 1000 }).applied).toEqual([
      "0001_core_profile",
      "0002_food_canonical_schema",
      "0003_food_staging_validation",
      "0004_food_import_review_fixes",
      "0005_food_search_key",
      "0006_food_search_key_nocase_index",
    ]);
    const names = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE name LIKE 'food_%' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining([
      "food_alias",
      "food_category",
      "food_dataset",
      "food_item",
      "food_nutrient_definition",
      "food_nutrient_value",
      "food_search_fts",
      "food_search_stats",
      "food_serving",
      "food_source_record",
      "food_staging_dataset",
      "food_staging_item",
      "food_staging_nutrient",
    ]));
  });

  it("upgrades existing nutrient rows to permit kJ without data loss", () => {
    const { sqlite } = openDatabase(":memory:");
    const beforeReviewFix = [...schema.CORE_MIGRATIONS, ...FOOD_MIGRATIONS.slice(0, 2)];
    applyMigrations(sqlite, beforeReviewFix, { now: () => 1000 });
    sqlite.prepare("INSERT INTO food_dataset (id, dataset_key, version, source_name, checksum, imported_at, status, record_count, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("dataset_1", "cfcd6", "v1", "CFCD", "checksum", 1000, "active", 1, "{}", "{}");
    sqlite.prepare("INSERT INTO food_item (id, canonical_key, primary_name, food_type, default_basis, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("food_1", "cfcd6:F001", "食物", "generic", "edible_100g", "A", 1, 1000, 1000);
    sqlite.prepare("INSERT INTO food_source_record (id, food_id, dataset_id, source_type, raw_json, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("source_1", "food_1", "dataset_1", "cfcd6", "{}", 1000, 1);
    sqlite.prepare("INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)")
      .run("energy_kcal", "能量", "kcal", "macro", 1, 1);
    sqlite.prepare("INSERT INTO food_nutrient_value (id, food_id, source_record_id, nutrient_id, amount_numeric, amount_raw, value_status, basis_amount, basis_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("value_1", "food_1", "source_1", "energy_kcal", 100, "100", "known", 100, "g", 1000);

    expect(applyMigrations(sqlite, [FOOD_MIGRATIONS[2]!], { now: () => 1000 }).applied).toEqual(["0004_food_import_review_fixes"]);
    expect(sqlite.prepare("SELECT amount_numeric FROM food_nutrient_value WHERE id = 'value_1'").get()).toEqual({ amount_numeric: 100 });
    expect(() => sqlite.prepare("INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)")
      .run("energy_kj", "能量", "kJ", "other", 2, 1)).not.toThrow();
    expect(sqlite.prepare("SELECT source_notes FROM food_source_record WHERE id = 'source_1'").get()).toEqual({ source_notes: null });
  });

  it("allows only one active version per dataset key", () => {
    const sqlite = createFood();
    const insert = sqlite.prepare(
      "INSERT INTO food_dataset (id, dataset_key, version, source_name, checksum, imported_at, status, record_count, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    expect(() => insert.run("dataset_2", "cfcd6-sanotsu", "v2", "CFCD", "checksum-2", 1001, "active", 2, "{}", "{}")).toThrow();
    expect(() => insert.run("dataset_3", "cfcd6-sanotsu", "v3", "CFCD", "checksum-3", 1001, "staging", 2, "{}", "{}")).not.toThrow();
    expect(() => insert.run("dataset_4", "cfcd6-sanotsu", "v4", "CFCD", "checksum-4", 1001, "archived", 2, "{}", "{}")).not.toThrow();
    expect(() => sqlite.prepare("DELETE FROM food_dataset WHERE id = ?").run("dataset_1")).toThrow();
  });

  it("rejects duplicate canonical keys and invalid food field values", () => {
    const sqlite = createFood();
    const insert = sqlite.prepare(
      "INSERT INTO food_item (id, canonical_key, primary_name, food_type, default_basis, edible_ratio, density_g_ml, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    expect(() => insert.run("food_2", "cfcd6:091101x", "重复", "generic", "edible_100g", null, null, "A", 1, 1000, 1000)).toThrow();
    expect(() => insert.run("food_3", "custom:bad-basis", "错误", "generic", "bad", null, null, "A", 1, 1000, 1000)).toThrow();
    expect(() => insert.run("food_4", "custom:bad-quality", "错误", "generic", "serving", null, null, "Z", 1, 1000, 1000)).toThrow();
    expect(() => insert.run("food_5", "custom:bad-type", "错误", "invalid", "serving", null, null, "A", 1, 1000, 1000)).toThrow();
    expect(() => insert.run("food_6", "custom:bad-edible", "错误", "custom", "serving", 1.01, null, "C", 1, 1000, 1000)).toThrow();
    expect(() => insert.run("food_7", "custom:bad-density", "错误", "custom", "serving", null, 0, "C", 1, 1000, 1000)).toThrow();
  });

  it("prevents orphan food relations while permitting soft deactivation", () => {
    const sqlite = createFood();
    sqlite.prepare("INSERT INTO food_source_record (id, food_id, dataset_id, source_type, raw_json, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("source_1", "food_1", "dataset_1", "cfcd6", "{\"foodCode\":\"091101x\"}", 1000, 1);
    sqlite.prepare("INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)")
      .run("protein_g", "蛋白质", "g", "macro", 1, 1);
    sqlite.prepare("INSERT INTO food_nutrient_value (id, food_id, source_record_id, nutrient_id, value_status, basis_amount, basis_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run("nutrient_1", "food_1", "source_1", "protein_g", "unknown", 100, "g", 1000);
    sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, ?, ?)")
      .run("alias_1", "food_1", "鸡肉", "鸡肉", "synonym", 0);
    sqlite.prepare("INSERT INTO food_serving (id, food_id, label, amount, unit, sort_order, source, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run("serving_1", "food_1", "100克", 100, "g", 0, "built_in", 1);

    expect(() => sqlite.prepare("DELETE FROM food_item WHERE id = ?").run("food_1")).toThrow();
    expect(() => sqlite.prepare("DELETE FROM food_source_record WHERE id = ?").run("source_1")).toThrow();
    expect(() => sqlite.prepare("DELETE FROM food_dataset WHERE id = ?").run("dataset_1")).toThrow();
    expect(() => sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, ?, ?)").run("orphan", "missing", "x", "x", "synonym", 0)).toThrow();
    expect(() => sqlite.prepare("INSERT INTO food_source_record (id, food_id, source_type, raw_json, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?)").run("candidate", "food_1", "ai_ocr_candidate", "{}", 1000, 1)).toThrow();
    expect(() => sqlite.prepare("UPDATE food_item SET active = 0 WHERE id = ?").run("food_1")).not.toThrow();
  });

  it("preserves trace and unknown raw nutrient strings and enforces nutrient constraints", () => {
    const sqlite = createFood();
    sqlite.prepare("INSERT INTO food_source_record (id, food_id, source_type, raw_json, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?)")
      .run("source_1", "food_1", "cfcd6", "{}", 1000, 1);
    sqlite.prepare("INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)")
      .run("iron_mg", "铁", "mg", "mineral", 1, 1);
    const insert = sqlite.prepare(
      "INSERT INTO food_nutrient_value (id, food_id, source_record_id, nutrient_id, amount_numeric, amount_raw, value_status, basis_amount, basis_unit, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    insert.run("trace", "food_1", "source_1", "iron_mg", null, "Tr", "trace", 100, "g", null, 1000);
    const rawTrace = sqlite.prepare("SELECT amount_numeric, amount_raw, value_status FROM food_nutrient_value WHERE id = ?").get("trace");
    expect(rawTrace).toEqual({ amount_numeric: null, amount_raw: "Tr", value_status: "trace" });
    sqlite.prepare("INSERT INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)")
      .run("vitamin_c_mg", "维生素C", "mg", "vitamin", 2, 1);
    insert.run("unknown", "food_1", "source_1", "vitamin_c_mg", null, "—", "unknown", 100, "g", null, 1000);
    expect(sqlite.prepare("SELECT amount_numeric, amount_raw FROM food_nutrient_value WHERE id = ?").get("unknown")).toEqual({ amount_numeric: null, amount_raw: "—" });
    expect(() => insert.run("bad-status", "food_1", "source_1", "iron_mg", null, null, "bad", 100, "g", null, 1000)).toThrow();
    expect(() => insert.run("bad-basis", "food_1", "source_1", "iron_mg", null, null, "known", 0, "g", null, 1000)).toThrow();
    expect(() => insert.run("bad-unit", "food_1", "source_1", "iron_mg", null, null, "known", 100, "oz", null, 1000)).toThrow();
    expect(() => insert.run("duplicate", "food_1", "source_1", "iron_mg", 1, "1", "known", 100, "g", null, 1000)).toThrow();
    sqlite.prepare("INSERT INTO food_item (id, canonical_key, primary_name, food_type, default_basis, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("food_2", "custom:other-food", "另一食物", "custom", "serving", "C", 1, 1000, 1000);
    sqlite.prepare("INSERT INTO food_source_record (id, food_id, source_type, raw_json, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?)")
      .run("source_2", "food_2", "custom", "{}", 1000, 1);
    expect(() => insert.run("cross-food", "food_1", "source_2", "iron_mg", 1, "1", "known", 100, "g", null, 1000)).toThrow();
  });

  it("enforces serving, alias, and search-stat validation while retaining search metadata", () => {
    const sqlite = createFood();
    expect(() => sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, ?, ?)").run("bad-alias", "food_1", "", "", "synonym", 0)).toThrow();
    sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, ?, ?)")
      .run("alias_1", "food_1", "西红柿", "xihongshi", "pinyin", 0);
    expect(sqlite.prepare("SELECT alias_normalized FROM food_alias WHERE id = ?").get("alias_1")).toEqual({ alias_normalized: "xihongshi" });
    expect(() => sqlite.prepare("INSERT INTO food_serving (id, food_id, label, amount, unit, sort_order, source, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("bad-serving", "food_1", "一份", 0, "g", 0, "user", 0)).toThrow();
    expect(() => sqlite.prepare("INSERT INTO food_serving (id, food_id, label, amount, unit, equivalent_g, sort_order, source, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("bad-equivalent", "food_1", "一份", 1, "ml", 0, 0, "user", 0)).toThrow();
    expect(() => sqlite.prepare("INSERT INTO food_search_stats (food_id, use_count, favorite, recent_score) VALUES (?, ?, ?, ?)").run("food_1", -1, 0, 0)).toThrow();
    sqlite.prepare("INSERT INTO food_search_stats (food_id, use_count, last_used_at, favorite, recent_score) VALUES (?, ?, ?, ?, ?)")
      .run("food_1", 3, 1000, 1, 2.5);
    expect(sqlite.prepare("SELECT use_count, last_used_at, favorite, recent_score FROM food_search_stats WHERE food_id = ?").get("food_1")).toEqual({ use_count: 3, last_used_at: 1000, favorite: 1, recent_score: 2.5 });
  });

  it("retains raw staging payloads linked to a staging dataset", () => {
    const sqlite = createFood();
    sqlite.prepare("INSERT INTO food_staging_dataset (id, dataset_key, version, source_name, checksum, imported_at, raw_manifest_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("staging_1", "cfcd6-sanotsu", "v2", "CFCD", "checksum-staging", 1000, "{\"source\":\"local\"}");
    sqlite.prepare("INSERT INTO food_staging_item (id, staging_dataset_id, source_record_id, raw_json, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("item_1", "staging_1", "091101x", "{\"foodName\":\"鸡\"}", 1000);
    sqlite.prepare("INSERT INTO food_staging_nutrient (id, staging_dataset_id, staging_item_id, nutrient_key, amount_raw, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("staging-nutrient_1", "staging_1", "item_1", "iron", "Tr", 1000);

    expect(sqlite.prepare("SELECT raw_json FROM food_staging_item WHERE id = ?").get("item_1")).toEqual({ raw_json: "{\"foodName\":\"鸡\"}" });
    expect(sqlite.prepare("SELECT amount_raw FROM food_staging_nutrient WHERE id = ?").get("staging-nutrient_1")).toEqual({ amount_raw: "Tr" });
    expect(() => sqlite.prepare("INSERT INTO food_staging_item (id, staging_dataset_id, source_record_id, raw_json, created_at) VALUES (?, ?, ?, ?, ?)").run("orphan-item", "missing", "x", "{}", 1000)).toThrow();
    sqlite.prepare("INSERT INTO food_staging_dataset (id, dataset_key, version, source_name, checksum, imported_at, raw_manifest_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("staging_2", "cfcd6-sanotsu", "v3", "CFCD", "checksum-staging-2", 1000, "{}");
    sqlite.prepare("INSERT INTO food_staging_item (id, staging_dataset_id, source_record_id, raw_json, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("item_2", "staging_2", "other", "{}", 1000);
    expect(() => sqlite.prepare("INSERT INTO food_staging_nutrient (id, staging_dataset_id, staging_item_id, nutrient_key, amount_raw, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("cross-dataset", "staging_1", "item_2", "iron", "Tr", 1000)).toThrow();
  });
});
