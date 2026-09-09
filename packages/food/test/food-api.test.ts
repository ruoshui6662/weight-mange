import { describe, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { CORE_MIGRATIONS, FOOD_MIGRATIONS } from "../../db/src/schema.js";
import { createFoodCatalog } from "../src/index.js";

function catalog() {
  const { sqlite } = openDatabase(":memory:");
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS]);
  sqlite.prepare("INSERT INTO food_dataset (id,dataset_key,version,source_name,checksum,imported_at,status,record_count,validation_json,metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("ds", "cfcd", "v1", "CFCD", "x", 1, "active", 2, "{}", "{}");
  for (const [id, name, active] of [["f1", "馒头", 1], ["f2", "馒头片", 1], ["f3", "失效馒头", 0]] as const) sqlite.prepare("INSERT INTO food_item (id, canonical_key, primary_name, food_type, default_basis, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, 'generic', 'edible_100g', 'A', ?, 1, 1)").run(id, `cfcd:${id}`, name, active);
  sqlite.prepare("INSERT INTO food_source_record (id,food_id,dataset_id,source_type,raw_json,source_url,imported_at,is_primary) VALUES ('s1','f1','ds','cfcd6','{}','https://example.test',1,1)").run();
  sqlite.prepare("INSERT INTO food_alias VALUES ('a1','f1','白馒头','白馒头','synonym',0)").run();
  sqlite.prepare("INSERT INTO food_nutrient_definition VALUES ('energy_kcal','能量','kcal','macro',0,1)").run();
  sqlite.prepare("INSERT INTO food_nutrient_value (id,food_id,source_record_id,nutrient_id,amount_numeric,amount_raw,value_status,basis_amount,basis_unit,created_at) VALUES ('n1','f1','s1','energy_kcal',223,'223','known',100,'g',1)").run();
  sqlite.prepare("INSERT INTO food_nutrient_definition VALUES ('fiber_g','膳食纤维','g','macro',1,1)").run();
  sqlite.prepare("INSERT INTO food_nutrient_value (id,food_id,source_record_id,nutrient_id,amount_numeric,amount_raw,value_status,basis_amount,basis_unit,created_at) VALUES ('n2','f1','s1','fiber_g',NULL,'Tr','trace',100,'g',1)").run();
  sqlite.prepare("INSERT INTO food_serving VALUES ('sv1','f1','1个',1,'g',80,NULL,0,'built_in',1)").run();
  return { sqlite, api: createFoodCatalog(sqlite, { now: () => 10, id: (() => { let n = 0; return () => `id${++n}`; })() }) };
}

describe("food catalog", () => {
  it("searches aliases, hides inactive rows and pages deterministically without network", () => { const { api, sqlite } = catalog(); expect(api.search({ q: "白馒头", limit: 1, scope: "all" }).data.map((x) => x.id)).toEqual(["f1"]); const first = api.search({ q: "馒", limit: 1, scope: "all" }); expect(first.nextCursor).toBeTruthy(); expect(api.search({ q: "馒", limit: 1, scope: "all", cursor: first.nextCursor! }).data).toHaveLength(1); expect(api.search({ q: "nothing", limit: 20, scope: "local" }).data).toEqual([]); expect(() => api.search({ q: "x", limit: 51, scope: "all" })).toThrow("FOOD_INVALID_LIMIT"); sqlite.close(); });
  it("preserves detail raw/status and protects reference writes", () => { const { api, sqlite } = catalog(); expect(api.detail("f1")?.nutrients).toEqual(expect.arrayContaining([expect.objectContaining({ raw: "Tr", status: "trace" })])); expect(() => api.update("f1", { name: "x" })).toThrow("FOOD_REFERENCE_READ_ONLY"); expect(api.detail("f3")).toBeNull(); sqlite.close(); });
  it("creates custom foods, validates alias/serving and toggles favorite idempotently", () => { const { api, sqlite } = catalog(); const food = api.createCustom({ name: "我的麦片", nutrients: { energyKcal: 100, proteinG: 3 }, aliases: [" 麦片 "], servings: [{ label: "一勺", amount: 1, unit: "g", equivalentG: 12 }] }); expect(api.search({ q: "麦片", limit: 20, scope: "custom" }).data[0]?.id).toBe(food.id); expect(api.detail(food.id)?.nutrients).toEqual(expect.arrayContaining([expect.objectContaining({ id: "energy_kcal", unit: "kcal" })])); expect(api.update(food.id, { nutrients: { energyKcal: 110 } })?.nutrients).toEqual(expect.arrayContaining([expect.objectContaining({ id: "energy_kcal", amount: 110 })])); expect(() => api.addAlias(food.id, "麦片")).toThrow("FOOD_ALIAS_DUPLICATE"); expect(() => api.addServing(food.id, { label: "bad", amount: 0, unit: "g", equivalentG: 1 })).toThrow("FOOD_INVALID_SERVING"); api.setFavorite(food.id, true); api.setFavorite(food.id, true); expect(api.detail(food.id)?.favorite).toBe(true); api.setFavorite(food.id, false); expect(api.detail(food.id)?.favorite).toBe(false); sqlite.close(); });
});
