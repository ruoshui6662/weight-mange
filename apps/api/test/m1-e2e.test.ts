import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { applyMigrations, createBackup, openDatabase, restoreBackup } from "@nutrition-tracker/db";
import { CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS, ANALYTICS_MIGRATIONS } from "@nutrition-tracker/db/schema";
import { importFoodDataset, type FoodImportDocument } from "../../../tools/food-import/src/index.js";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

type Envelope = { data?: unknown; error?: { code?: string } };
async function json(response: Response) { return await response.json() as Envelope; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }
function headers(sessionCookie: string) { return { "content-type": "application/json", cookie: sessionCookie }; }

function mantouDataset(version: string, energyKcal: string): FoodImportDocument {
  return {
    datasetKey: "cfcd6-e2e",
    version,
    sourceName: "Controlled E2E fixture",
    checksum: `checksum-${version}`,
    foods: [{
      foodCode: "MANTOU-001",
      foodName: "馒头",
      aliases: ["馒头", "面食馒头"],
      edible: "100",
      energyKCal: energyKcal,
      energyKJ: String(Number(energyKcal) * 4.184),
      protein: "7",
      fat: "1",
      CHO: "48",
      dietaryFiber: "2",
      servings: [{ label: "一个", amount: 50, unit: "g" }],
    }],
  };
}

function seedFood(dbPath: string, document: FoodImportDocument) {
  const { sqlite } = openDatabase(dbPath);
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS]);
  const result = importFoodDataset(sqlite, JSON.stringify(document), { now: () => 1_700_000_000_000 });
  sqlite.close();
  return result;
}

it("runs the offline food diary golden flow across restart and backup restore", async () => {
  const directory = mkdtempSync(join(tmpdir(), "m1-e2e-")); directories.push(directory);
  const dbPath = join(directory, "app.sqlite");
  const backupPath = join(directory, "backups", "app.sqlite");
  const restoredPath = join(directory, "restored", "app.sqlite");
  expect(seedFood(dbPath, mantouDataset("v1", "230")).status).toBe("promoted");

  let runtime = await startApiServer({ dbPath, port: 0 });
  let sessionCookie: string;
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "E2E Owner", password: "correct horse battery staple", timezone: "Asia/Shanghai" }) });
    expect(boot.status).toBe(201);
    sessionCookie = cookie(boot);

    const search = await fetch(`${base}/api/v1/foods/search?q=${encodeURIComponent("馒头")}`, { headers: { cookie: sessionCookie } });
    expect(search.status).toBe(200);
    const searchBody = await json(search);
    const result = (searchBody.data as Array<{ id: string; name: string }>)[0];
    expect(result).toMatchObject({ id: "food:cfcd6:MANTOU-001", name: "馒头" });

    const create = await fetch(`${base}/api/v1/diary/2026-09-09/entries`, { method: "POST", headers: { ...headers(sessionCookie), "idempotency-key": "m1-e2e-breakfast" }, body: JSON.stringify({ mealSlotId: "breakfast", foodId: result.id, amount: 75, unit: "g", source: "manual" }) });
    expect(create.status).toBe(201);
    const created = (await json(create)).data as { id: string; amount: number; version: number; nutrients: Array<{ nutrientId: string; amountNumeric: number | null }> };
    expect(created).toMatchObject({ amount: 75, version: 1 });
    expect(created.nutrients.find((nutrient) => nutrient.nutrientId === "energy_kcal")?.amountNumeric).toBe(172.5);

    const update = await fetch(`${base}/api/v1/diary/2026-09-09/entries/${created.id}`, { method: "PATCH", headers: headers(sessionCookie), body: JSON.stringify({ amount: 100, version: created.version }) });
    expect(update.status).toBe(200);
    const updated = (await json(update)).data as { id: string; amount: number; version: number; nutrients: Array<{ nutrientId: string; amountNumeric: number | null }> };
    expect(updated).toMatchObject({ id: created.id, amount: 100, version: 2 });
    expect(updated.nutrients.find((nutrient) => nutrient.nutrientId === "energy_kcal")?.amountNumeric).toBe(230);

    const copied = await fetch(`${base}/api/v1/diary/2026-09-10/copy-meal`, { method: "POST", headers: headers(sessionCookie), body: JSON.stringify({ fromDate: "2026-09-09", fromMealSlotId: "breakfast", toMealSlotId: "breakfast" }) });
    expect(copied.status).toBe(201);
    const copiedEntries = (await json(copied)).data as Array<{ id: string; amount: number; entrySource: string }>;
    expect(copiedEntries).toHaveLength(1);
    expect(copiedEntries[0]).toMatchObject({ amount: 100, entrySource: "copy" });

    const deleted = await fetch(`${base}/api/v1/diary/2026-09-10/entries/${copiedEntries[0]!.id}`, { method: "DELETE", headers: headers(sessionCookie) });
    expect(deleted.status).toBe(200);
    const emptyTarget = await fetch(`${base}/api/v1/diary/2026-09-10`, { headers: { cookie: sessionCookie } });
    expect(((await json(emptyTarget)).data as { entries: unknown[] }).entries).toHaveLength(0);
  } finally {
    await runtime.close();
  }

  expect(seedFood(dbPath, mantouDataset("v2", "460")).status).toBe("promoted");
  runtime = await startApiServer({ dbPath, port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "correct horse battery staple" }) });
    expect(login.status).toBe(200);
    sessionCookie = cookie(login);
    const history = await fetch(`${base}/api/v1/diary/2026-09-09`, { headers: { cookie: sessionCookie } });
    const historyEntry = ((await json(history)).data as { entries: Array<{ nutrients: Array<{ nutrientId: string; amountNumeric: number | null }> }> }).entries[0];
    expect(historyEntry.nutrients.find((nutrient) => nutrient.nutrientId === "energy_kcal")?.amountNumeric).toBe(230);
  } finally {
    await runtime.close();
  }

  const source = new DatabaseSync(dbPath);
  await createBackup(source, backupPath, { now: () => 1_700_000_000_001 });
  source.close();
  restoreBackup({ backupPath, destinationPath: restoredPath });

  runtime = await startApiServer({ dbPath: restoredPath, port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "correct horse battery staple" }) });
    sessionCookie = cookie(login);
    const restored = await fetch(`${base}/api/v1/diary/2026-09-09`, { headers: { cookie: sessionCookie } });
    expect(restored.status).toBe(200);
    const restoredEntry = ((await json(restored)).data as { entries: Array<{ amount: number; nutrients: Array<{ nutrientId: string; amountNumeric: number | null }> }> }).entries[0];
    expect(restoredEntry.amount).toBe(100);
    expect(restoredEntry.nutrients.find((nutrient) => nutrient.nutrientId === "energy_kcal")?.amountNumeric).toBe(230);
  } finally {
    await runtime.close();
  }
});
