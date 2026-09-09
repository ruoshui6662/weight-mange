import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";

import { startApiServer } from "../apps/api/dist/index.js";
import { applyMigrations, openDatabase } from "../packages/db/dist/index.js";
import { ANALYTICS_MIGRATIONS, BODY_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "../packages/db/dist/schema.js";
import { createFoodCatalog } from "../packages/food/dist/index.js";

const directory = mkdtempSync(join(tmpdir(), "nutrition-e2e-"));
const dbPath = process.env.E2E_DB_PATH ?? join(directory, "db", "app.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const seed = openDatabase(dbPath);
applyMigrations(seed.sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS, ...BODY_MIGRATIONS]);
createFoodCatalog(seed.sqlite).createCustom({ name: "馒头", nutrients: { energyKcal: 223, proteinG: 7.1, fatG: 1.1, carbG: 47.0 }, aliases: ["白馒头"] });
seed.sqlite.close();
const runtime = await startApiServer({
  dbPath,
  port: Number(process.env.PORT ?? 4173),
  webDistDir: join(process.cwd(), "apps", "web", "dist"),
});

console.log(`e2e server ready: http://127.0.0.1:${runtime.port}`);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await runtime.close();
  rmSync(directory, { force: true, recursive: true });
}

process.once("SIGTERM", () => { void shutdown().finally(() => process.exit(0)); });
process.once("SIGINT", () => { void shutdown().finally(() => process.exit(0)); });
