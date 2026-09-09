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
  return { sqlite, foodId: food.id, foods, diary: createDiaryService(sqlite, { now: () => 100, id: (() => { let i = 0; return () => `diary-id-${++i}`; })() }) };
}

it("writes an immutable scaled nutrient snapshot and returns stored totals after a food edit", () => {
  const { sqlite, foodId, diary } = setup();
  const entry = diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 75, unit: "g", source: "manual", idempotencyKey: "entry-1" });
  expect(entry.nutrients.find((value) => value.nutrientId === "energy_kcal")).toMatchObject({ amountNumeric: 22.5, amountRaw: "22.5", valueStatus: "known" });
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=99 WHERE food_id=? AND nutrient_id='energy_kcal'").run(foodId);
  expect(diary.getDay({ userId: "user-1", date: "2026-09-09" }).dailyTotal.nutrients.energy_kcal.amount).toBe(22.5);
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

it("returns meal and daily totals with snapshot status coverage", () => {
  const { sqlite, foodId, diary } = setup();
  const source = sqlite.prepare("SELECT id FROM food_source_record WHERE food_id=? AND is_primary=1").get(foodId) as { id: string };
  sqlite.prepare("INSERT INTO food_nutrient_definition (id,display_name,unit,nutrient_group,display_order,summable) VALUES ('fiber_g','纤维','g','macro',9,1)").run();
  sqlite.prepare("INSERT INTO food_nutrient_value (id,food_id,source_record_id,nutrient_id,amount_numeric,amount_raw,value_status,basis_amount,basis_unit,created_at) VALUES ('trace-fiber',?,?, 'fiber_g',NULL,'Tr','trace',100,'g',1)").run(foodId, source.id);
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 100, unit: "g", source: "manual" });
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "lunch", foodId, amount: 100, unit: "g", source: "manual" });
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=999 WHERE food_id=? AND nutrient_id='energy_kcal'").run(foodId);
  const result = diary.getDay({ userId: "user-1", date: "2026-09-09" });
  expect(result.mealTotals.breakfast.nutrients.energy_kcal.amount).toBe(30);
  expect(result.dailyTotal.nutrients.energy_kcal.amount).toBe(60);
  expect(result.dailyTotal.nutrients.fiber_g).toMatchObject({ amount: 0, coverage: 0, hasTrace: true });
});

it("persists a serving id and copyDay re-resolves active servings or falls back to snapshots", () => {
  const { sqlite, foodId, foods, diary } = setup();
  const servingId = foods.addServing(foodId, { label: "一杯", amount: 250, unit: "g", equivalentG: 250 });
  const entry = diary.createEntry({ userId: "user-1", date: "2026-09-08", mealSlotId: "breakfast", foodId, amount: 1, unit: "serving", servingId, source: "manual" });
  expect(entry.servingId).toBe(servingId);
  const activeCopy = diary.copyDay({ userId: "user-1", date: "2026-09-09", fromDate: "2026-09-08" });
  expect(activeCopy[0]).toMatchObject({ entrySource: "copy", servingId });
  sqlite.prepare("UPDATE food_item SET active=0 WHERE id=?").run(foodId);
  const fallback = diary.copyDay({ userId: "user-1", date: "2026-09-10", fromDate: "2026-09-08" });
  expect(fallback[0]).toMatchObject({ entrySource: "copy_snapshot", servingId });
  expect(fallback[0]?.nutrients.find((value) => value.nutrientId === "energy_kcal")?.amountNumeric).toBe(75);
});

it("weights coverage by stored gram equivalents rather than entry count", () => {
  const { sqlite, foodId, diary } = setup();
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 1, unit: "g", source: "manual" });
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=NULL,amount_raw='—',value_status='unknown' WHERE food_id=? AND nutrient_id='energy_kcal'").run(foodId);
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "lunch", foodId, amount: 100, unit: "g", source: "manual" });
  expect(diary.getDay({ userId: "user-1", date: "2026-09-09" }).dailyTotal.nutrients.energy_kcal.coverage).toBeCloseTo(1 / 101);
});

it("rolls back an entire copied meal if a later serving cannot be resolved", () => {
  const { sqlite, foodId, foods, diary } = setup();
  const servingId = foods.addServing(foodId, { label: "一杯", amount: 250, unit: "g", equivalentG: 250 });
  diary.createEntry({ userId: "user-1", date: "2026-09-08", mealSlotId: "breakfast", foodId, amount: 10, unit: "g", source: "manual" });
  diary.createEntry({ userId: "user-1", date: "2026-09-08", mealSlotId: "breakfast", foodId, amount: 1, unit: "serving", servingId, source: "manual" });
  sqlite.prepare("DELETE FROM food_serving WHERE id=?").run(servingId);
  expect(() => diary.copyMeal({ userId: "user-1", date: "2026-09-09", fromDate: "2026-09-08", fromMealSlotId: "breakfast", toMealSlotId: "lunch" })).toThrow("DIARY_SERVING_NOT_FOUND");
  expect(sqlite.prepare("SELECT count(*) count FROM diary_entry e JOIN diary_day d ON d.id=e.diary_day_id WHERE d.local_date='2026-09-09'").get()).toMatchObject({ count: 0 });
});

it("binds the goal effective on a new day and never rewrites an existing day", () => {
  const { sqlite, diary } = setup();
  sqlite.prepare("INSERT INTO profile_nutrition_goal (id,user_id,effective_from,goal_type,calorie_target_kcal,source,created_at) VALUES ('goal-old','user-1','2026-09-01','maintain',2000,'manual',1)").run();
  diary.getDay({ userId: "user-1", date: "2026-09-09" });
  sqlite.prepare("UPDATE profile_nutrition_goal SET effective_to='2026-09-09' WHERE id='goal-old'").run();
  sqlite.prepare("INSERT INTO profile_nutrition_goal (id,user_id,effective_from,goal_type,calorie_target_kcal,source,created_at) VALUES ('goal-new','user-1','2026-09-10','loss',1800,'manual',2)").run();
  expect(sqlite.prepare("SELECT goal_id goalId FROM diary_day WHERE user_id='user-1' AND local_date='2026-09-09'").get()).toEqual({ goalId: "goal-old" });
});
