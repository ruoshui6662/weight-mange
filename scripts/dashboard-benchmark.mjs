import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyMigrations, openDatabase } from "../packages/db/dist/index.js";
import { ANALYTICS_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "../packages/db/dist/schema.js";
import { createDiaryService } from "../packages/diary/dist/index.js";
import { createFoodCatalog } from "../packages/food/dist/index.js";
import { createDashboardService } from "../packages/dashboard/dist/index.js";

const directory = mkdtempSync(join(tmpdir(), "dashboard-benchmark-"));
const { sqlite } = openDatabase(join(directory, "app.sqlite"));
try {
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS]);
  sqlite.prepare("INSERT INTO profile_user (id,display_name,timezone,created_at,updated_at) VALUES ('bench-user','Bench','UTC',1,1)").run();
  sqlite.prepare("INSERT INTO profile_nutrition_goal (id,user_id,effective_from,goal_type,calorie_target_kcal,source,created_at) VALUES ('bench-goal','bench-user','2026-01-01','maintain',2000,'manual',1)").run();
  const foods = createFoodCatalog(sqlite, { now: () => 10, id: (() => { let i = 0; return () => `bench-food-${++i}`; })() });
  const food = foods.createCustom({ name: "基准食物", nutrients: { energyKcal: 100, proteinG: 10, fatG: 5, carbG: 20 } });
  const diary = createDiaryService(sqlite, { now: () => 100, id: (() => { let i = 0; return () => `bench-diary-${++i}`; })() });
  diary.createEntry({ userId: "bench-user", date: "2026-09-09", mealSlotId: "breakfast", foodId: food.id, amount: 100, unit: "g", source: "manual" });
  const dashboard = createDashboardService(sqlite, { now: () => 200 });
  dashboard.getDashboard({ userId: "bench-user", date: "2026-09-09" });
  const values = [];
  for (let index = 0; index < 1000; index += 1) {
    const start = process.hrtime.bigint();
    dashboard.getDashboard({ userId: "bench-user", date: "2026-09-09" });
    values.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  values.sort((left, right) => left - right);
  const quantile = (position) => values[Math.floor(values.length * position)];
  console.log(`dashboard benchmark n=1000 p50=${quantile(0.5)?.toFixed(3)}ms p95=${quantile(0.95)?.toFixed(3)}ms`);
} finally {
  sqlite.close();
  rmSync(directory, { force: true, recursive: true });
}
