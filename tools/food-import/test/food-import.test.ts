import { describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../../packages/db/src/index.js";
import { CORE_MIGRATIONS, FOOD_MIGRATIONS } from "../../../packages/db/src/schema.js";
import {
  importFoodDataset,
  parseFoodImport,
  promoteStagedDataset,
  type FoodImportDocument,
} from "../src/index.js";

const NOW = 1_700_000_000_000;
const importerOptions = { now: () => NOW, importerVersion: "test-importer-v1" };

function openFoodDatabase() {
  const { sqlite } = openDatabase(":memory:");
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS], { now: () => NOW });
  return sqlite;
}

function food(index: number): Record<string, unknown> {
  const code = `T${String(index).padStart(3, "0")}`;
  return {
    foodCode: code,
    foodName: `合成食物 ${index}`,
    englishName: `Synthetic food ${index}`,
    edible: index === 1 ? "63" : "100",
    energyKCal: String(80 + index),
    protein: index === 1 ? "Tr" : String(index),
    fat: index === 2 ? "—" : "1.5",
    CHO: String(10 + index),
    dietaryFiber: "2.5",
    cholesterol: "0",
    energyKJ: "420",
    vitaminA: "10",
    Ca: "20",
    aliases: index === 1 ? ["合成别名", "测试食物"] : [],
    servings: index === 1 ? [{ label: "一份", amount: 50, unit: "g" }] : [],
    remark: "synthetic fixture",
  };
}

function document(version = "v1"): FoodImportDocument {
  return {
    datasetKey: "cfcd6-synthetic",
    version,
    sourceName: "Synthetic CFCD fixture",
    checksum: `checksum-${version}`,
    foods: Array.from({ length: 20 }, (_, index) => food(index + 1)),
  };
}

describe("food import staging pipeline", () => {
  it("parses documented array/object shapes while preserving raw values and reporting malformed records", () => {
    const parsed = parseFoodImport(JSON.stringify(document()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.foods).toHaveLength(20);
    expect(parsed.document.foods[0]?.nutrients.protein).toMatchObject({ amountRaw: "Tr", valueStatus: "trace", amountNumeric: null });
    expect(parsed.document.foods[1]?.nutrients.fat).toMatchObject({ amountRaw: "—", valueStatus: "unknown", amountNumeric: null });
    const arrayDocument = document();
    arrayDocument.foods[0] = { ...arrayDocument.foods[0], datasetKey: arrayDocument.datasetKey, version: arrayDocument.version, sourceName: arrayDocument.sourceName, checksum: arrayDocument.checksum };
    expect(parseFoodImport(JSON.stringify(arrayDocument.foods)).ok).toBe(true);
    expect(parseFoodImport("{").errors[0]?.code).toBe("INVALID_JSON");
    expect(parseFoodImport(JSON.stringify({ ...document(), foods: [{ foodCode: "", foodName: "" }] })).errors.map((error) => error.code)).toEqual(expect.arrayContaining(["MISSING_FOOD_CODE", "MISSING_FOOD_NAME"]));
    expect(parseFoodImport(JSON.stringify({ ...document(), foods: [food(1), food(1)] })).errors[0]?.code).toBe("DUPLICATE_FOOD_CODE");
  });

  it("parses numeric values with a trailing source footnote marker without losing the raw value", () => {
    const parsed = parseFoodImport(JSON.stringify({ ...document(), foods: [{ ...food(1), energyKCal: "899*", energyKJ: "3761*" }] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.foods[0]?.nutrients.energyKCal).toMatchObject({ amountRaw: "899*", amountNumeric: 899, valueStatus: "known" });
    expect(parsed.document.foods[0]?.nutrients.energyKJ).toMatchObject({ amountRaw: "3761*", amountNumeric: 3761, valueStatus: "known" });
  });

  it("preserves the source unknown marker used by the remote dataset", () => {
    const input = JSON.stringify({ ...document(), foods: [{ ...food(1), energyKCal: "un" }] });
    const parsed = parseFoodImport(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.foods[0]?.nutrients.energyKCal).toMatchObject({ amountRaw: "un", amountNumeric: null, valueStatus: "unknown" });
    expect(importFoodDataset(openFoodDatabase(), input, importerOptions).status).toBe("promoted");
  });

  it("stages, validates, normalizes, promotes, and explicitly rebuilds FTS without losing raw nutrient states", () => {
    const sqlite = openFoodDatabase();
    const result = importFoodDataset(sqlite, JSON.stringify(document()), importerOptions);
    expect(result.status).toBe("promoted");
    expect(result.diff.added).toHaveLength(20);
    expect(sqlite.prepare("SELECT status FROM food_dataset").get()).toMatchObject({ status: "active" });
    expect(sqlite.prepare("SELECT amount_raw, amount_numeric, value_status FROM food_nutrient_value WHERE nutrient_id = 'protein_g' AND food_id = ?").get("food:cfcd6:T001")).toMatchObject({ amount_raw: "Tr", amount_numeric: null, value_status: "trace" });
    expect(sqlite.prepare("SELECT unit FROM food_nutrient_definition WHERE id = 'energy_kj'").get()).toEqual({ unit: "kJ" });
    expect(sqlite.prepare("SELECT amount_raw, amount_numeric FROM food_nutrient_value WHERE nutrient_id = 'energy_kj' AND food_id = ?").get("food:cfcd6:T001")).toEqual({ amount_raw: "420", amount_numeric: 420 });
    expect(sqlite.prepare("SELECT source_notes FROM food_source_record WHERE food_id = ?").get("food:cfcd6:T001")).toEqual({ source_notes: "synthetic fixture" });
    expect(sqlite.prepare("SELECT alias_normalized FROM food_alias WHERE food_id = ? ORDER BY alias_normalized").all("food:cfcd6:T001")).toEqual([{ alias_normalized: "合成别名" }, { alias_normalized: "测试食物" }]);
    expect(sqlite.prepare("SELECT amount, unit, equivalent_g FROM food_serving WHERE food_id = ?").get("food:cfcd6:T001")).toMatchObject({ amount: 50, unit: "g", equivalent_g: 50 });
    expect(sqlite.prepare("SELECT food_id, primary_name FROM food_search_fts WHERE food_search_fts MATCH '合成食物'").all()).toHaveLength(20);
  });

  it("is idempotent for an exact dataset identity and does not duplicate canonical rows", () => {
    const sqlite = openFoodDatabase();
    expect(importFoodDataset(sqlite, JSON.stringify(document()), importerOptions).status).toBe("promoted");
    expect(importFoodDataset(sqlite, JSON.stringify(document()), importerOptions).status).toBe("already_promoted");
    expect(sqlite.prepare("SELECT count(*) AS count FROM food_item").get()).toEqual({ count: 20 });
  });

  it("isolates invalid imports and leaves the active catalog untouched", () => {
    const sqlite = openFoodDatabase();
    importFoodDataset(sqlite, JSON.stringify(document()), importerOptions);
    const invalid = document("v2");
    invalid.foods[0] = { ...food(1), edible: "101" };
    const result = importFoodDataset(sqlite, JSON.stringify(invalid), importerOptions);
    expect(result.status).toBe("failed");
    expect(result.validation.errors[0]?.code).toBe("INVALID_EDIBLE_PERCENTAGE");
    expect(sqlite.prepare("SELECT version FROM food_dataset WHERE status = 'active'").get()).toEqual({ version: "v1" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM food_item").get()).toEqual({ count: 20 });
    expect(sqlite.prepare("SELECT status FROM food_staging_dataset WHERE version = 'v2'").get()).toEqual({ status: "failed" });
  });

  it("audits structural parse failures with complete metadata in staging while leaving active data unchanged", () => {
    const sqlite = openFoodDatabase();
    importFoodDataset(sqlite, JSON.stringify(document()), importerOptions);
    const broken = document("broken");
    broken.foods = [{ ...food(1), foodName: "" }, food(1)];
    const result = importFoodDataset(sqlite, JSON.stringify(broken), importerOptions);
    expect(result.status).toBe("failed");
    expect(result.stagingDatasetId).toBe("staging:cfcd6-synthetic:broken:checksum-broken");
    expect(sqlite.prepare("SELECT status, validation_json, raw_manifest_json FROM food_staging_dataset WHERE id = ?").get(result.stagingDatasetId!)).toMatchObject({ status: "failed", validation_json: expect.stringContaining("MISSING_FOOD_NAME"), raw_manifest_json: JSON.stringify(broken) });
    expect(sqlite.prepare("SELECT version FROM food_dataset WHERE status = 'active'").get()).toEqual({ version: "v1" });
  });

  it("does not downgrade a promoted staging identity when a malformed document reuses its identity", () => {
    const sqlite = openFoodDatabase();
    importFoodDataset(sqlite, JSON.stringify(document("collision")), importerOptions);
    const malformed = document("collision");
    malformed.foods = [{ ...food(1), foodName: "" }];

    const result = importFoodDataset(sqlite, JSON.stringify(malformed), importerOptions);

    expect(result.status).toBe("already_promoted");
    expect(sqlite.prepare("SELECT status FROM food_staging_dataset WHERE id = ?").get(result.stagingDatasetId!)).toEqual({ status: "promoted" });
    expect(importFoodDataset(sqlite, JSON.stringify(document("collision")), importerOptions).status).toBe("already_promoted");
  });

  it("rejects non-finite and non-marker numeric strings instead of treating them as unknown", () => {
    const sqlite = openFoodDatabase();
    const invalid = document("nonfinite");
    invalid.foods[0] = { ...food(1), protein: "1e309", fat: "not-a-number" };
    const result = importFoodDataset(sqlite, JSON.stringify(invalid), importerOptions);
    expect(result.status).toBe("failed");
    expect(result.validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining(["INVALID_NUTRIENT_NUMBER"]));
    expect(sqlite.prepare("SELECT status FROM food_staging_dataset WHERE version = 'nonfinite'").get()).toEqual({ status: "failed" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM food_dataset").get()).toEqual({ count: 0 });
  });

  it("reports version diffs and rolls back a failed promotion without changing active data or FTS", () => {
    const sqlite = openFoodDatabase();
    importFoodDataset(sqlite, JSON.stringify(document()), importerOptions);
    const v2 = document("v2");
    v2.foods[0] = { ...food(1), foodName: "合成食物一号", energyKCal: "181", protein: "9", vitaminA: "11", edible: "80" };
    const staged = importFoodDataset(sqlite, JSON.stringify(v2), { ...importerOptions, promote: false });
    expect(staged.status).toBe("staged");
    expect(staged.diff.changedName).toEqual(["T001"]);
    expect(staged.diff.changedMacro).toEqual(["T001"]);
    expect(staged.diff.changedMicronutrient).toEqual(["T001"]);
    expect(staged.diff.changedEdible).toEqual(["T001"]);
    expect(staged.diff.changedEnergy).toEqual(["T001"]);
    expect(() => promoteStagedDataset(sqlite, staged.stagingDatasetId!, { ...importerOptions, failAfterCanonicalRows: 1 })).toThrow("PROMOTE_TEST_FAILURE");
    expect(sqlite.prepare("SELECT version FROM food_dataset WHERE status = 'active'").get()).toEqual({ version: "v1" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM food_search_fts").get()).toEqual({ count: 20 });
  });
});
