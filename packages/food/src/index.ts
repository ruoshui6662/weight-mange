import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export class FoodError extends Error { constructor(readonly code: string) { super(code); } }
type Scope = "all" | "local" | "custom";
type ServingInput = { label: string; amount: number; unit: "g" | "ml"; equivalentG?: number; equivalentMl?: number; isDefault?: boolean };
type CustomInput = { name: string; englishName?: string; brand?: string; nutrients: { energyKcal: number; proteinG: number; fatG?: number; carbG?: number }; aliases?: string[]; servings?: ServingInput[] };
type SearchInput = { q: string; limit: number; scope: Scope; cursor?: string };
type Options = { now?: () => number; id?: () => string };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function createFoodCatalog(sqlite: DatabaseSync, options: Options = {}) {
  const now = options.now ?? Date.now;
  const id = options.id ?? randomUUID;
  const owned = (foodId: string) => {
    const row = sqlite.prepare("SELECT 1 AS ok FROM food_source_record WHERE food_id = ? AND source_type IN ('custom', 'user_label') LIMIT 1").get(foodId) as { ok?: number } | undefined;
    if (!row) throw new FoodError("FOOD_REFERENCE_READ_ONLY");
  };
  const active = (foodId: string) => {
    const row = sqlite.prepare("SELECT id FROM food_item WHERE id = ? AND active = 1").get(foodId);
    if (!row) throw new FoodError("FOOD_NOT_FOUND");
  };
  const addAlias = (foodId: string, alias: string) => {
    active(foodId); owned(foodId);
    const text = alias.trim().replace(/\s+/g, " "); const normalized = normalize(text);
    if (!text) throw new FoodError("FOOD_INVALID_ALIAS");
    const duplicate = sqlite.prepare("SELECT 1 FROM food_alias WHERE food_id = ? AND alias_normalized = ?").get(foodId, normalized);
    if (duplicate) throw new FoodError("FOOD_ALIAS_DUPLICATE");
    const aliasId = id(); sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, 'synonym', 1)").run(aliasId, foodId, text, normalized);
    return aliasId;
  };
  const addServing = (foodId: string, input: ServingInput) => {
    active(foodId); owned(foodId);
    if (!input.label.trim() || !positive(input.amount) || !["g", "ml"].includes(input.unit) || (!positive(input.equivalentG) && !positive(input.equivalentMl))) throw new FoodError("FOOD_INVALID_SERVING");
    const servingId = id(); sqlite.prepare("INSERT INTO food_serving (id, food_id, label, amount, unit, equivalent_g, equivalent_ml, sort_order, source, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'user', ?)").run(servingId, foodId, input.label.trim(), input.amount, input.unit, input.equivalentG ?? null, input.equivalentMl ?? null, input.isDefault ? 1 : 0);
    return servingId;
  };
  return {
    search(input: SearchInput) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) throw new FoodError("FOOD_INVALID_LIMIT");
      if (!["all", "local", "custom"].includes(input.scope)) throw new FoodError("FOOD_INVALID_SCOPE");
      const q = normalize(input.q); if (!q) return { data: [], nextCursor: null };
      let offset = 0;
      if (input.cursor) { try { offset = Number(Buffer.from(input.cursor, "base64url").toString("utf8")); } catch { throw new FoodError("FOOD_INVALID_CURSOR"); } if (!Number.isInteger(offset) || offset < 0) throw new FoodError("FOOD_INVALID_CURSOR"); }
      const scope = input.scope === "custom" ? "AND fi.food_type = 'custom'" : input.scope === "local" ? "AND fi.food_type <> 'custom'" : "";
      const rows = sqlite.prepare(`SELECT fi.id, fi.primary_name name, fi.english_name englishName, fi.brand, fi.default_basis basis, fi.source_quality quality, sr.source_type source, COALESCE(st.favorite,0) favorite, COALESCE(st.last_used_at,0) recentAt,
        MAX(CASE WHEN lower(fi.primary_name) = ? THEN 3 WHEN fa.alias_normalized = ? THEN 3 WHEN lower(fi.primary_name) LIKE ? OR fa.alias_normalized LIKE ? THEN 2 ELSE 1 END) rank
        FROM food_item fi LEFT JOIN food_alias fa ON fa.food_id = fi.id LEFT JOIN food_source_record sr ON sr.food_id = fi.id AND sr.is_primary = 1 LEFT JOIN food_search_stats st ON st.food_id = fi.id
        WHERE fi.active = 1 ${scope} AND (lower(fi.primary_name) LIKE ? OR lower(COALESCE(fi.english_name,'')) LIKE ? OR fa.alias_normalized LIKE ?)
        GROUP BY fi.id ORDER BY rank DESC, favorite DESC, recentAt DESC, lower(fi.primary_name), fi.id LIMIT ? OFFSET ?`).all(q, q, `${q}%`, `${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, input.limit + 1, offset) as Array<Record<string, unknown>>;
      const page = rows.slice(0, input.limit).map((row) => ({ id: String(row.id), name: String(row.name), englishName: row.englishName as string | null, brand: row.brand as string | null, source: row.source ?? null, quality: row.quality, basis: { amount: 100, unit: row.basis === "liquid_100ml" ? "ml" : "g" }, summary: this.summary(String(row.id)), favorite: row.favorite === 1, recent: Number(row.recentAt) > 0 }));
      return { data: page, nextCursor: rows.length > input.limit ? Buffer.from(String(offset + input.limit)).toString("base64url") : null };
    },
    summary(foodId: string) { const rows = sqlite.prepare("SELECT nutrient_id, amount_numeric FROM food_nutrient_value WHERE food_id = ?").all(foodId) as Array<{ nutrient_id: string; amount_numeric: number | null }>; const value = (key: string) => rows.find((x) => x.nutrient_id === key)?.amount_numeric ?? null; return { energyKcal: value("energy_kcal"), proteinG: value("protein_g"), fatG: value("fat_g"), carbG: value("carbohydrate_g") }; },
    detail(foodId: string) { const food = sqlite.prepare("SELECT fi.*, sr.source_type source, sr.source_url sourceUrl, fd.version datasetVersion, COALESCE(st.favorite,0) favorite, COALESCE(st.use_count,0) useCount, st.last_used_at lastUsedAt FROM food_item fi LEFT JOIN food_source_record sr ON sr.food_id=fi.id AND sr.is_primary=1 LEFT JOIN food_dataset fd ON fd.id=sr.dataset_id LEFT JOIN food_search_stats st ON st.food_id=fi.id WHERE fi.id=? AND fi.active=1").get(foodId) as Record<string, unknown> | undefined; if (!food) return null; return { id: food.id, name: food.primary_name, englishName: food.english_name, brand: food.brand, source: food.source, sourceUrl: food.sourceUrl, quality: food.source_quality, datasetVersion: food.datasetVersion, favorite: food.favorite === 1, usage: { count: food.useCount, lastUsedAt: food.lastUsedAt }, aliases: sqlite.prepare("SELECT id,alias,alias_type type,user_defined userDefined FROM food_alias WHERE food_id=? ORDER BY alias_normalized").all(foodId), servings: sqlite.prepare("SELECT id,label,amount,unit,equivalent_g equivalentG,equivalent_ml equivalentMl,source,is_default isDefault FROM food_serving WHERE food_id=? ORDER BY sort_order,id").all(foodId), nutrients: sqlite.prepare("SELECT nv.nutrient_id id,nd.display_name name,nd.unit,nv.amount_numeric amount,nv.amount_raw raw,nv.value_status status,nv.basis_amount basisAmount,nv.basis_unit basisUnit FROM food_nutrient_value nv JOIN food_nutrient_definition nd ON nd.id=nv.nutrient_id WHERE nv.food_id=? ORDER BY nd.display_order,nv.nutrient_id").all(foodId) }; },
    createCustom(input: CustomInput) { if (!input.name.trim() || !positive(input.nutrients.energyKcal) || !positive(input.nutrients.proteinG)) throw new FoodError("FOOD_INVALID_CUSTOM"); const foodId=id(), sourceId=id(), timestamp=now(); sqlite.exec("BEGIN IMMEDIATE"); try { sqlite.prepare("INSERT INTO food_item (id,canonical_key,primary_name,english_name,brand,food_type,default_basis,source_quality,active,created_at,updated_at) VALUES (?, ?, ?, ?, ?, 'custom','edible_100g','C',1,?,?)").run(foodId, `custom:${foodId}`, input.name.trim(), input.englishName ?? null, input.brand ?? null, timestamp, timestamp); sqlite.prepare("INSERT INTO food_source_record (id,food_id,source_type,raw_json,imported_at,is_primary) VALUES (?,?,'custom',?, ?,1)").run(sourceId,foodId,JSON.stringify(input),timestamp); for (const [key, label, unit, amount] of [["energy_kcal","能量","kcal",input.nutrients.energyKcal],["protein_g","蛋白质","g",input.nutrients.proteinG],["fat_g","脂肪","g",input.nutrients.fatG],["carbohydrate_g","碳水化合物","g",input.nutrients.carbG]] as const) if (amount !== undefined) { sqlite.prepare("INSERT OR IGNORE INTO food_nutrient_definition (id,display_name,unit,nutrient_group,display_order,summable) VALUES (?,?,?,'macro',0,1)").run(key,label,unit); sqlite.prepare("INSERT INTO food_nutrient_value (id,food_id,source_record_id,nutrient_id,amount_numeric,amount_raw,value_status,basis_amount,basis_unit,created_at) VALUES (?,?,?,?,?,?, 'known',100,'g',?)").run(id(),foodId,sourceId,key,amount,String(amount),timestamp); } sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; } for (const alias of input.aliases ?? []) addAlias(foodId, alias); for (const serving of input.servings ?? []) addServing(foodId, serving); return { id: foodId }; },
    update(foodId: string, input: { name?: string; version?: number; nutrients?: Partial<CustomInput["nutrients"]> }) { active(foodId); owned(foodId); if (input.version !== undefined) { const current = sqlite.prepare("SELECT updated_at FROM food_item WHERE id=?").get(foodId) as { updated_at: number }; if (current.updated_at !== input.version) throw new FoodError("FOOD_VERSION_CONFLICT"); } if (input.name !== undefined && !input.name.trim()) throw new FoodError("FOOD_INVALID_CUSTOM"); if (input.nutrients && Object.values(input.nutrients).some((amount) => amount !== undefined && !positive(amount))) throw new FoodError("FOOD_INVALID_CUSTOM"); const timestamp=now(); sqlite.exec("BEGIN IMMEDIATE"); try { sqlite.prepare("UPDATE food_item SET primary_name=COALESCE(?,primary_name),updated_at=? WHERE id=?").run(input.name?.trim() ?? null,timestamp,foodId); const source=sqlite.prepare("SELECT id FROM food_source_record WHERE food_id=? AND source_type IN ('custom','user_label') ORDER BY is_primary DESC LIMIT 1").get(foodId) as { id: string }; for (const [key,amount] of [["energy_kcal",input.nutrients?.energyKcal],["protein_g",input.nutrients?.proteinG],["fat_g",input.nutrients?.fatG],["carbohydrate_g",input.nutrients?.carbG]] as const) if (amount !== undefined) sqlite.prepare("UPDATE food_nutrient_value SET amount_numeric=?,amount_raw=?,value_status='known',created_at=? WHERE food_id=? AND source_record_id=? AND nutrient_id=?").run(amount,String(amount),timestamp,foodId,source.id,key); sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; } return this.detail(foodId); },
    addAlias, deleteAlias(foodId: string, aliasId: string) { active(foodId); owned(foodId); const row=sqlite.prepare("SELECT user_defined FROM food_alias WHERE id=? AND food_id=?").get(aliasId,foodId) as { user_defined?: number } | undefined; if (!row || row.user_defined !== 1) throw new FoodError("FOOD_ALIAS_READ_ONLY"); sqlite.prepare("DELETE FROM food_alias WHERE id=?").run(aliasId); },
    addServing, updateServing(foodId: string, servingId: string, input: ServingInput) { active(foodId); owned(foodId); const row=sqlite.prepare("SELECT source FROM food_serving WHERE id=? AND food_id=?").get(servingId,foodId) as { source?: string } | undefined; if (!row || row.source !== "user") throw new FoodError("FOOD_SERVING_READ_ONLY"); if (!input.label.trim() || !positive(input.amount) || (!positive(input.equivalentG) && !positive(input.equivalentMl))) throw new FoodError("FOOD_INVALID_SERVING"); sqlite.prepare("UPDATE food_serving SET label=?,amount=?,unit=?,equivalent_g=?,equivalent_ml=?,is_default=? WHERE id=?").run(input.label.trim(),input.amount,input.unit,input.equivalentG ?? null,input.equivalentMl ?? null,input.isDefault?1:0,servingId); }, deleteServing(foodId: string, servingId: string) { active(foodId); owned(foodId); const row=sqlite.prepare("SELECT source FROM food_serving WHERE id=? AND food_id=?").get(servingId,foodId) as { source?: string } | undefined; if (!row || row.source !== "user") throw new FoodError("FOOD_SERVING_READ_ONLY"); sqlite.prepare("DELETE FROM food_serving WHERE id=?").run(servingId); },
    setFavorite(foodId: string, favorite: boolean) { active(foodId); sqlite.prepare("INSERT INTO food_search_stats (food_id,favorite) VALUES (?,?) ON CONFLICT(food_id) DO UPDATE SET favorite=excluded.favorite").run(foodId,favorite?1:0); },
  };
}
