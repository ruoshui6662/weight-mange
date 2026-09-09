import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "@nutrition-tracker/db";
import { CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "@nutrition-tracker/db/schema";
import { createFoodCatalog } from "@nutrition-tracker/food";
import { createDiaryService } from "../src/index.js";

const directories: string[] = [];
const connections: Array<{ close(): void }> = [];
afterEach(() => { connections.splice(0).forEach((sqlite) => sqlite.close()); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "diary-")); directories.push(directory);
  const { sqlite } = openDatabase(join(directory, "app.sqlite"));
  connections.push(sqlite);
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS]);
  sqlite.prepare("INSERT INTO profile_user (id,display_name,timezone,created_at,updated_at) VALUES ('user-1','User','Asia/Shanghai',1,1)").run();
  const foods = createFoodCatalog(sqlite, { now: () => 10, id: (() => { let i = 0; return () => `food-id-${++i}`; })() });
  const food = foods.createCustom({ name: "豆浆", nutrients: { energyKcal: 30, proteinG: 2, fatG: 1, carbG: 3 } });
  return { sqlite, foodId: food.id, diary: createDiaryService(sqlite, { now: () => 100, id: (() => { let i = 0; return () => `diary-id-${++i}`; })() }) };
}

it("writes an immutable scaled nutrient snapshot and returns stored totals after a food edit", () => {
  const { sqlite, foodId, diary } = setup();
  const entry = diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 75, unit: "g", source: "manual", idempotencyKey: "entry-1" });
  expect(entry.nutrients.find((value) => value.nutrientId === "energy_kcal")).toMatchObject({ amountNumeric: 22.5, amountRaw: "22.5", valueStatus: "known" });
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=99 WHERE food_id=? AND nutrient_id='energy_kcal'").run(foodId);
  expect(diary.getDay({ userId: "user-1", date: "2026-09-09" }).total.nutrients.energy_kcal.amount).toBe(22.5);
});

it("is idempotent, rejects stale updates, and replaces only the edited snapshot", () => {
  const { sqlite, foodId, diary } = setup();
  const input = { userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 100, unit: "g" as const, source: "manual" as const, idempotencyKey: "same" };
  const first = diary.createEntry(input); const duplicate = diary.createEntry(input);
  expect(duplicate.id).toBe(first.id);
  expect(sqlite.prepare("SELECT count(*) count FROM diary_entry").get()).toMatchObject({ count: 1 });
  expect(() => diary.updateEntry({ userId: "user-1", date: "2026-09-09", entryId: first.id, amount: 50, version: 0 })).toThrow("DIARY_VERSION_CONFLICT");
  const updated = diary.updateEntry({ userId: "user-1", date: "2026-09-09", entryId: first.id, amount: 50, version: first.version });
  expect(updated.version).toBe(first.version + 1);
  expect(updated.nutrients.find((value) => value.nutrientId === "energy_kcal")?.amountNumeric).toBe(15);
});

it("copies an old snapshot when its source food is inactive", () => {
  const { sqlite, foodId, diary } = setup();
  diary.createEntry({ userId: "user-1", date: "2026-09-08", mealSlotId: "breakfast", foodId, amount: 100, unit: "g", source: "manual" });
  sqlite.prepare("UPDATE food_item SET active=0 WHERE id=?").run(foodId);
  const copied = diary.copyMeal({ userId: "user-1", date: "2026-09-09", fromDate: "2026-09-08", fromMealSlotId: "breakfast", toMealSlotId: "lunch" });
  expect(copied).toHaveLength(1);
  expect(copied[0]).toMatchObject({ entrySource: "copy_snapshot", displayNameSnapshot: "豆浆" });
  expect(copied[0]?.nutrients.find((value) => value.nutrientId === "energy_kcal")?.amountNumeric).toBe(30);
});

it("rolls back an invalid entry without creating a day or meal slots", () => {
  const { sqlite, foodId, diary } = setup();
  expect(() => diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "not-a-meal", foodId, amount: 10, unit: "g", source: "manual" })).toThrow("DIARY_MEAL_SLOT_NOT_FOUND");
  expect(sqlite.prepare("SELECT count(*) count FROM diary_day").get()).toMatchObject({ count: 0 });
});
