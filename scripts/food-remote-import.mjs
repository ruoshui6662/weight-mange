import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { applyMigrations, openDatabase } from "../packages/db/dist/index.js";
import { ANALYTICS_MIGRATIONS, BODY_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS, RECIPE_MIGRATIONS } from "../packages/db/dist/schema.js";
import { importFoodDataset } from "../tools/food-import/dist/index.js";
import { fetchRemoteFoodDataset } from "../tools/food-import/dist/remote.js";

const env = process.env;
const enabled = env.FOOD_DATA_REMOTE_ENABLED === "true";
const dbPath = env.DB_PATH ?? "/data/db/app.sqlite";

function hasActiveCatalog(path) {
  if (!existsSync(path)) return false;
  try {
    const { sqlite } = openDatabase(path);
    try {
      const row = sqlite.prepare("SELECT COUNT(*) AS count FROM food_dataset WHERE status = 'active' AND record_count > 0").get();
      return Number(row?.count ?? 0) > 0;
    } finally {
      sqlite.close();
    }
  } catch {
    return false;
  }
}

function migrations() {
  return [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS, ...BODY_MIGRATIONS, ...RECIPE_MIGRATIONS];
}

if (!enabled) {
  console.log(JSON.stringify({ event: "food_remote_import_skipped", reason: "disabled" }));
  process.exit(0);
}

const options = {
  repository: env.FOOD_DATA_REMOTE_REPOSITORY ?? "ruoshui6662/china-food-composition-data",
  ref: env.FOOD_DATA_REMOTE_REF ?? "main",
  directory: env.FOOD_DATA_REMOTE_DIRECTORY ?? "json_data_v3_20260825_qwen38max_kimi_k3_fixed_en",
  datasetKey: env.FOOD_DATA_REMOTE_DATASET_KEY ?? "cfcd6-ruoshui-fork",
  version: env.FOOD_DATA_REMOTE_VERSION ?? "20260825-fixed-en",
  sourceName: env.FOOD_DATA_REMOTE_SOURCE_NAME ?? "China Food Composition Data (test fork)",
};

let remote;
try {
  remote = await fetchRemoteFoodDataset(options);
} catch (error) {
  if (hasActiveCatalog(dbPath)) {
    console.warn(JSON.stringify({ event: "food_remote_import_skipped", reason: "remote_unavailable", message: error instanceof Error ? error.message : String(error) }));
    process.exit(0);
  }
  throw error;
}

mkdirSync(dirname(dbPath), { recursive: true });
const { sqlite } = openDatabase(dbPath);
try {
  applyMigrations(sqlite, migrations());
  const result = importFoodDataset(sqlite, JSON.stringify(remote.document), { now: Date.now, importerVersion: "remote-github-bootstrap-v1" });
  if (result.status === "failed") {
    const message = result.validation.errors.map((item) => `${item.code}:${item.path}`).join(",");
    if (hasActiveCatalog(dbPath)) {
      console.warn(JSON.stringify({ event: "food_remote_import_skipped", reason: "validation_failed", message }));
      process.exit(0);
    }
    throw new Error(`REMOTE_FOOD_IMPORT_FAILED:${message}`);
  }
  console.log(JSON.stringify({ event: "food_remote_import", status: result.status, datasetKey: remote.document.datasetKey, version: remote.document.version, files: remote.files.length, foods: remote.document.foods.length, checksum: remote.document.checksum }));
} finally {
  sqlite.close();
}
