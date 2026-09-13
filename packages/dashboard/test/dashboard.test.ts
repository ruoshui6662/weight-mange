import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "@nutrition-tracker/db";
import { ANALYTICS_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "@nutrition-tracker/db/schema";
import { createDiaryService } from "@nutrition-tracker/diary";
import { createFoodCatalog } from "@nutrition-tracker/food";
import { createDashboardService } from "../src/index.js";

const directories: string[] = [];
const connections: Array<{ close(): void }> = [];
afterEach(() => { connections.splice(0).forEach((sqlite) => sqlite.close()); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "dashboard-")); directories.push(directory);
  const { sqlite } = openDatabase(join(directory, "app.sqlite")); connections.push(sqlite);
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS]);
  sqlite.prepare("INSERT INTO profile_user (id,display_name,timezone,created_at,updated_at) VALUES ('user-1','User','Asia/Shanghai',1,1)").run();
  const foods = createFoodCatalog(sqlite, { now: () => 10, id: (() => { let i = 0; return () => `food-${++i}`; })() });
  const food = foods.createCustom({ name: "仪表盘食物", nutrients: { energyKcal: 100, proteinG: 10, fatG: 5, carbG: 20 } });
  const diary = createDiaryService(sqlite, { now: () => 100, id: (() => { let i = 0; return () => `diary-${++i}`; })() });
  const dashboard = createDashboardService(sqlite, { now: () => 200 });
  return { sqlite, foodId: food.id, diary, dashboard };
}

it("builds a goal-bound dashboard from stored snapshots and rebuilds a deleted cache", () => {
  const { sqlite, foodId, diary, dashboard } = setup();
  sqlite.prepare("INSERT INTO profile_nutrition_goal (id,user_id,effective_from,goal_type,calorie_target_kcal,protein_target_g,fat_target_g,carb_target_g,source,created_at) VALUES ('goal-old','user-1','2026-09-01','maintain',250,50,60,70,'manual',1)").run();
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "breakfast", foodId, amount: 100, unit: "g", source: "manual" });
  sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=NULL,amount_raw='—',value_status='unknown' WHERE food_id=? AND nutrient_id='energy_kcal'").run(foodId);
  diary.createEntry({ userId: "user-1", date: "2026-09-09", mealSlotId: "lunch", foodId, amount: 50, unit: "g", source: "manual" });
  const source = sqlite.prepare("SELECT id FROM food_source_record WHERE food_id=? AND is_primary=1").get(foodId) as { id: string };
  sqlite.prepare("INSERT INTO food_nutrient_definition (id,display_name,unit,nutrient_group,display_order,summable) VALUES ('fiber_g','纤维','g','macro',9,1)").run();
  sqlite.prepare("INSERT INTO food_nutrient_value (id,food_id,source_record_id,nutrient_id,amount_numeric,amount_raw,value_status,basis_amount,basis_unit,created_at) VALUES ('fiber',?,?, 'fiber_g',NULL,'Tr','trace',100,'g',1)").run(foodId, source.id);
  const first = dashboard.getDashboard({ userId: "user-1", date: "2026-09-09" });
  expect(first).toMatchObject({ date: "2026-09-09", goal: { kcal: 250, proteinG: 50, fatG: 60, carbG: 70, fiberG: null }, intake: { kcal: 100, proteinG: 15, fatG: 7.5, carbG: 30, fiberG: null }, remainingKcal: 150, exercise: { burnKcal: 0, creditKcal: 0, available: false } });
  expect(first.coverage.energy_kcal.coverage).toBeCloseTo(100 / 150);
  expect(first.meals).toEqual(expect.arrayContaining([
    { key: "breakfast", displayName: "早餐", totals: { kcal: 100 } },
    { key: "lunch", displayName: "午餐", totals: { kcal: 0 } },
  ]));
  sqlite.prepare("DELETE FROM analytics_daily_summary WHERE user_id='user-1' AND local_date='2026-09-09'").run();
  expect(dashboard.getDashboard({ userId: "user-1", date: "2026-09-09" })).toEqual(first);
  sqlite.prepare("UPDATE profile_nutrition_goal SET effective_to='2026-09-09' WHERE id='goal-old'").run();
  sqlite.prepare("INSERT INTO profile_nutrition_goal (id,user_id,effective_from,goal_type,calorie_target_kcal,source,created_at) VALUES ('goal-new','user-1','2026-09-10','loss',1800,'manual',2)").run();
  expect(dashboard.getDashboard({ userId: "user-1", date: "2026-09-09" }).goal?.kcal).toBe(250);
});

it("returns explicit no-goal fields for a new day without an effective goal", () => {
  const { dashboard } = setup();
  expect(dashboard.getDashboard({ userId: "user-1", date: "2026-09-09" })).toMatchObject({ goal: null, remainingKcal: null, intake: { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: null }, exercise: { burnKcal: 0, creditKcal: 0, available: false } });
});
