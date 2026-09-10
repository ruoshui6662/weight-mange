import type { DatabaseSync } from "node:sqlite";

export const FOOD_IMPORTER_VERSION = "1.0.0";

export type FoodImportDocument = {
  datasetKey: string;
  version: string;
  sourceName: string;
  checksum: string;
  sourceUrl?: string;
  sourceNotes?: string;
  foods: Array<Record<string, unknown>>;
};

type NutrientStatus = "known" | "trace" | "unknown";
type ParsedNutrient = { key: string; amountRaw: string | null; amountNumeric: number | null; valueStatus: NutrientStatus };
type ParsedFood = {
  foodCode: string;
  foodName: string;
  englishName: string | null;
  edibleRaw: string | null;
  edibleRatio: number | null;
  aliases: string[];
  servings: Array<{ label: string; amount: number; unit: "g" | "ml" }>;
  remark: string | null;
  rawJson: string;
  nutrients: Record<string, ParsedNutrient>;
};
type ParsedDocument = Omit<FoodImportDocument, "foods"> & { foods: ParsedFood[] };

export type ValidationError = { code: string; path: string; message: string };
export type ValidationWarning = { code: string; path: string; message: string };
export type ValidationReport = { errors: ValidationError[]; warnings: ValidationWarning[] };
export type ImportDiff = { added: string[]; removed: string[]; changedName: string[]; changedMacro: string[]; changedMicronutrient: string[]; changedEdible: string[]; changedEnergy: string[] };
export type ParseResult = { ok: true; document: ParsedDocument; errors: [] } | { ok: false; errors: ValidationError[] };
export type ImportOptions = { now: () => number; importerVersion?: string; promote?: boolean; failAfterCanonicalRows?: number };
export type ImportResult = {
  status: "promoted" | "staged" | "failed" | "already_staged" | "already_promoted";
  stagingDatasetId?: string;
  validation: ValidationReport;
  diff: ImportDiff;
  metadata: { importerVersion: string };
};

const NUTRIENTS = {
  water: ["water_g", "水", "g", "other"], energyKCal: ["energy_kcal", "能量", "kcal", "macro"], energyKJ: ["energy_kj", "能量", "kJ", "other"],
  protein: ["protein_g", "蛋白质", "g", "macro"], fat: ["fat_g", "脂肪", "g", "macro"], CHO: ["carbohydrate_g", "碳水化合物", "g", "macro"], dietaryFiber: ["dietary_fiber_g", "膳食纤维", "g", "macro"], cholesterol: ["cholesterol_mg", "胆固醇", "mg", "other"], ash: ["ash_g", "灰分", "g", "other"],
  vitaminA: ["vitamin_a_ug", "维生素A", "µg", "vitamin"], carotene: ["carotene_ug", "胡萝卜素", "µg", "vitamin"], retinol: ["retinol_ug", "视黄醇", "µg", "vitamin"], thiamin: ["thiamin_mg", "硫胺素", "mg", "vitamin"], riboflavin: ["riboflavin_mg", "核黄素", "mg", "vitamin"], niacin: ["niacin_mg", "烟酸", "mg", "vitamin"], vitaminC: ["vitamin_c_mg", "维生素C", "mg", "vitamin"], vitaminETotal: ["vitamin_e_mg", "维生素E", "mg", "vitamin"],
  Ca: ["calcium_mg", "钙", "mg", "mineral"], P: ["phosphorus_mg", "磷", "mg", "mineral"], K: ["potassium_mg", "钾", "mg", "mineral"], Na: ["sodium_mg", "钠", "mg", "mineral"], Mg: ["magnesium_mg", "镁", "mg", "mineral"], Fe: ["iron_mg", "铁", "mg", "mineral"], Zn: ["zinc_mg", "锌", "mg", "mineral"], Se: ["selenium_ug", "硒", "µg", "mineral"], Cu: ["copper_mg", "铜", "mg", "mineral"], Mn: ["manganese_mg", "锰", "mg", "mineral"],
} as const;
type NutrientInputKey = keyof typeof NUTRIENTS;
const MACRO_KEYS = new Set<NutrientInputKey>(["protein", "fat", "CHO", "dietaryFiber"]);
const UNKNOWN_MARKERS = new Set(["", "—", "un"]);

function emptyDiff(): ImportDiff { return { added: [], removed: [], changedName: [], changedMacro: [], changedMicronutrient: [], changedEdible: [], changedEnergy: [] }; }
function asNonEmptyString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function rawValue(value: unknown): string | null { return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : null; }
function isUnknownMarker(value: string) { return UNKNOWN_MARKERS.has(value) || value.toLowerCase() === "un"; }
function parseNutrient(key: string, value: unknown): ParsedNutrient {
  const amountRaw = rawValue(value);
  if (amountRaw === "Tr") return { key, amountRaw, amountNumeric: null, valueStatus: "trace" };
  if (amountRaw === null || isUnknownMarker(amountRaw)) return { key, amountRaw, amountNumeric: null, valueStatus: "unknown" };
  const numericRaw = amountRaw.replace(/\*+$/, "");
  const numeric = numericRaw ? Number(numericRaw) : Number.NaN;
  return Number.isFinite(numeric) ? { key, amountRaw, amountNumeric: numeric, valueStatus: "known" } : { key, amountRaw, amountNumeric: null, valueStatus: "unknown" };
}

export function parseFoodImport(raw: string): ParseResult {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { ok: false, errors: [{ code: "INVALID_JSON", path: "$", message: "Input is not valid JSON." }] }; }
  if (value === null || typeof value !== "object") return { ok: false, errors: [{ code: "INVALID_DOCUMENT", path: "$", message: "Document must be an object or an array of food records." }] };
  const input = Array.isArray(value)
    ? (value[0] !== null && typeof value[0] === "object" && !Array.isArray(value[0]) ? { ...(value[0] as Record<string, unknown>), foods: value } : { foods: value })
    : value as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const datasetKey = asNonEmptyString(input.datasetKey); const version = asNonEmptyString(input.version); const sourceName = asNonEmptyString(input.sourceName); const checksum = asNonEmptyString(input.checksum);
  for (const [name, field] of [["datasetKey", datasetKey], ["version", version], ["sourceName", sourceName], ["checksum", checksum]] as const) if (!field) errors.push({ code: "MISSING_METADATA", path: `$.${name}`, message: `${name} is required.` });
  const foodsInput = input.foods;
  if (!Array.isArray(foodsInput)) errors.push({ code: "MISSING_FOODS", path: "$.foods", message: "foods must be an array." });
  const foods: ParsedFood[] = []; const codes = new Set<string>();
  if (Array.isArray(foodsInput)) foodsInput.forEach((item, index) => {
    const path = `$.foods[${index}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) { errors.push({ code: "NON_OBJECT_RECORD", path, message: "Every food record must be an object." }); return; }
    const row = item as Record<string, unknown>; const foodCode = asNonEmptyString(row.foodCode); const foodName = asNonEmptyString(row.foodName);
    if (!foodCode) errors.push({ code: "MISSING_FOOD_CODE", path: `${path}.foodCode`, message: "foodCode is required." });
    if (!foodName) errors.push({ code: "MISSING_FOOD_NAME", path: `${path}.foodName`, message: "foodName is required." });
    if (!foodCode || !foodName) return;
    if (codes.has(foodCode)) { errors.push({ code: "DUPLICATE_FOOD_CODE", path: `${path}.foodCode`, message: `Duplicate foodCode: ${foodCode}.` }); return; }
    codes.add(foodCode);
    const nutrients = Object.fromEntries(Object.keys(NUTRIENTS).map((key) => [key, parseNutrient(key, row[key])]));
    const edibleRaw = rawValue(row.edible); const edibleNumber = edibleRaw === null || edibleRaw === "" || edibleRaw === "—" ? null : Number(edibleRaw);
    const servings: Array<{ label: string; amount: number; unit: "g" | "ml" }> = Array.isArray(row.servings) ? row.servings.flatMap((serving) => {
      if (serving === null || typeof serving !== "object" || Array.isArray(serving)) return [];
      const record = serving as Record<string, unknown>; const label = asNonEmptyString(record.label); const amount = typeof record.amount === "number" ? record.amount : Number(record.amount); const unit = record.unit;
      return label && Number.isFinite(amount) && amount > 0 && (unit === "g" || unit === "ml") ? [{ label, amount, unit: unit as "g" | "ml" }] : [];
    }) : [];
    const aliases = Array.isArray(row.aliases) ? row.aliases.map(asNonEmptyString).filter((alias): alias is string => alias !== null) : [];
    foods.push({ foodCode, foodName, englishName: asNonEmptyString(row.englishName), edibleRaw, edibleRatio: edibleNumber !== null && Number.isFinite(edibleNumber) ? edibleNumber / 100 : null, aliases, servings, remark: asNonEmptyString(row.remark), rawJson: JSON.stringify(row), nutrients });
  });
  const sourceUrl = asNonEmptyString(input.sourceUrl); const sourceNotes = asNonEmptyString(input.sourceNotes);
  return errors.length ? { ok: false, errors } : { ok: true, document: { datasetKey: datasetKey!, version: version!, sourceName: sourceName!, checksum: checksum!, ...(sourceUrl ? { sourceUrl } : {}), ...(sourceNotes ? { sourceNotes } : {}), foods }, errors: [] };
}

function stagingId(document: ParsedDocument) { return `staging:${document.datasetKey}:${document.version}:${document.checksum}`; }
function datasetId(document: ParsedDocument) { return `dataset:${document.datasetKey}:${document.version}:${document.checksum}`; }
function namespace(document: ParsedDocument) { return document.datasetKey.startsWith("cfcd6") ? "cfcd6" : document.datasetKey.replace(/[^a-z0-9_-]/gi, "_").toLowerCase(); }
function foodId(document: ParsedDocument, code: string) { return `food:${namespace(document)}:${code}`; }
function sourceId(document: ParsedDocument, code: string) { return `source:${document.datasetKey}:${document.version}:${code}`; }

type ImportMetadata = Pick<FoodImportDocument, "datasetKey" | "version" | "sourceName" | "checksum">;

function extractMetadata(raw: string): ImportMetadata | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const value = candidate as Record<string, unknown>;
    const datasetKey = asNonEmptyString(value.datasetKey); const version = asNonEmptyString(value.version); const sourceName = asNonEmptyString(value.sourceName); const checksum = asNonEmptyString(value.checksum);
    return datasetKey && version && sourceName && checksum ? { datasetKey, version, sourceName, checksum } : null;
  } catch { return null; }
}

function stageParseFailure(sqlite: DatabaseSync, raw: string, metadata: ImportMetadata, validation: ValidationReport, options: ImportOptions): string {
  const id = `staging:${metadata.datasetKey}:${metadata.version}:${metadata.checksum}`;
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare("INSERT INTO food_staging_dataset (id, dataset_key, version, source_name, checksum, imported_at, raw_manifest_json, status, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?) ON CONFLICT(id) DO UPDATE SET status = 'failed', validation_json = excluded.validation_json, metadata_json = excluded.metadata_json").run(id, metadata.datasetKey, metadata.version, metadata.sourceName, metadata.checksum, options.now(), raw, JSON.stringify(validation), JSON.stringify({ importerVersion: options.importerVersion ?? FOOD_IMPORTER_VERSION }));
    sqlite.exec("COMMIT");
    return id;
  } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
}

function validate(document: ParsedDocument): ValidationReport {
  const errors: ValidationError[] = []; const warnings: ValidationWarning[] = [];
  for (const food of document.foods) {
    if ((food.edibleRaw !== null && !["", "—"].includes(food.edibleRaw) && food.edibleRatio === null) || (food.edibleRatio !== null && (food.edibleRatio < 0 || food.edibleRatio > 1))) errors.push({ code: "INVALID_EDIBLE_PERCENTAGE", path: `food:${food.foodCode}.edible`, message: "edible must be a finite percentage between 0 and 100." });
    for (const nutrient of Object.values(food.nutrients)) {
      if (nutrient.amountNumeric !== null && nutrient.amountNumeric < 0) errors.push({ code: "NEGATIVE_NUTRIENT", path: `food:${food.foodCode}.${nutrient.key}`, message: "Nutrient values cannot be negative." });
      if (nutrient.amountRaw !== null && nutrient.amountRaw !== "Tr" && !isUnknownMarker(nutrient.amountRaw) && nutrient.amountNumeric === null) errors.push({ code: "INVALID_NUTRIENT_NUMBER", path: `food:${food.foodCode}.${nutrient.key}`, message: "Nutrient values must be finite numeric strings or documented unknown markers." });
    }
    const kcal = food.nutrients.energyKCal!.amountNumeric; const kj = food.nutrients.energyKJ!.amountNumeric;
    if (kcal !== null && kj !== null && Math.abs(kj - kcal * 4.184) / Math.max(kj, 1) > 0.1) warnings.push({ code: "ENERGY_INCONSISTENCY", path: `food:${food.foodCode}`, message: "kcal/kJ difference exceeds 10%." });
  }
  return { errors, warnings };
}

function stage(sqlite: DatabaseSync, document: ParsedDocument, options: ImportOptions): string {
  const id = stagingId(document); const now = options.now();
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare("INSERT INTO food_staging_dataset (id, dataset_key, version, source_name, checksum, imported_at, raw_manifest_json, status, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, 'staged', '{}', ?)").run(id, document.datasetKey, document.version, document.sourceName, document.checksum, now, JSON.stringify(document), JSON.stringify({ importerVersion: options.importerVersion ?? FOOD_IMPORTER_VERSION }));
    for (const food of document.foods) {
      const itemId = `${id}:item:${food.foodCode}`;
      sqlite.prepare("INSERT INTO food_staging_item (id, staging_dataset_id, source_record_id, raw_json, created_at) VALUES (?, ?, ?, ?, ?)").run(itemId, id, food.foodCode, food.rawJson, now);
      for (const nutrient of Object.values(food.nutrients)) sqlite.prepare("INSERT INTO food_staging_nutrient (id, staging_dataset_id, staging_item_id, nutrient_key, amount_raw, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(`${itemId}:nutrient:${nutrient.key}`, id, itemId, nutrient.key, nutrient.amountRaw, now);
    }
    sqlite.exec("COMMIT"); return id;
  } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
}

function loadStaged(sqlite: DatabaseSync, id: string): ParsedDocument {
  const row = sqlite.prepare("SELECT raw_manifest_json FROM food_staging_dataset WHERE id = ?").get(id) as { raw_manifest_json?: string } | undefined;
  if (!row?.raw_manifest_json) throw new Error("STAGING_DATASET_NOT_FOUND");
  const parsed = JSON.parse(row.raw_manifest_json) as ParsedDocument;
  return parsed;
}

function activeRows(sqlite: DatabaseSync, key: string) {
  return sqlite.prepare("SELECT ds.id, ds.version FROM food_dataset ds WHERE ds.dataset_key = ? AND ds.status = 'active'").get(key) as { id: string; version: string } | undefined;
}

function buildDiff(sqlite: DatabaseSync, document: ParsedDocument): ImportDiff {
  const active = activeRows(sqlite, document.datasetKey); const diff = emptyDiff();
  if (!active) { diff.added = document.foods.map((food) => food.foodCode); return diff; }
  const rows = sqlite.prepare("SELECT sr.source_record_id AS code, fi.primary_name, fi.edible_ratio, nv.nutrient_id, nv.amount_raw FROM food_source_record sr JOIN food_item fi ON fi.id = sr.food_id LEFT JOIN food_nutrient_value nv ON nv.source_record_id = sr.id WHERE sr.dataset_id = ?").all(active.id) as Array<{ code: string; primary_name: string; edible_ratio: number | null; nutrient_id: string | null; amount_raw: string | null }>;
  const previous = new Map<string, { name: string; edible: number | null; nutrients: Map<string, string | null> }>();
  for (const row of rows) { const item = previous.get(row.code) ?? { name: row.primary_name, edible: row.edible_ratio, nutrients: new Map<string, string | null>() }; if (row.nutrient_id) item.nutrients.set(row.nutrient_id, row.amount_raw); previous.set(row.code, item); }
  const incoming = new Set(document.foods.map((food) => food.foodCode));
  diff.removed = [...previous.keys()].filter((code) => !incoming.has(code));
  for (const food of document.foods) { const old = previous.get(food.foodCode); if (!old) { diff.added.push(food.foodCode); continue; } if (old.name !== food.foodName) diff.changedName.push(food.foodCode); if (old.edible !== food.edibleRatio) diff.changedEdible.push(food.foodCode); let macro = false; let micronutrient = false; let energy = false; for (const [inputKey, tuple] of Object.entries(NUTRIENTS) as Array<[NutrientInputKey, readonly string[]]>) { const oldRaw = old.nutrients.get(tuple[0]!); const nextRaw = food.nutrients[inputKey]!.amountRaw; if (oldRaw !== nextRaw) { if (inputKey === "energyKCal" || inputKey === "energyKJ") energy = true; else if (MACRO_KEYS.has(inputKey)) macro = true; else micronutrient = true; } } if (macro) diff.changedMacro.push(food.foodCode); if (micronutrient) diff.changedMicronutrient.push(food.foodCode); if (energy) diff.changedEnergy.push(food.foodCode); }
  return diff;
}

function ensureDefinitions(sqlite: DatabaseSync) { for (const [inputKey, tuple] of Object.entries(NUTRIENTS) as Array<[NutrientInputKey, readonly string[]]>) sqlite.prepare("INSERT OR IGNORE INTO food_nutrient_definition (id, display_name, unit, nutrient_group, display_order, summable) VALUES (?, ?, ?, ?, ?, ?)").run(tuple[0]!, tuple[1]!, tuple[2]!, tuple[3]!, Object.keys(NUTRIENTS).indexOf(inputKey), 1); }
function normalizeAlias(alias: string) { return alias.trim().toLowerCase().replace(/\s+/g, " "); }

export function promoteStagedDataset(sqlite: DatabaseSync, id: string, options: ImportOptions): ImportResult {
  const document = loadStaged(sqlite, id); const validation = validate(document); const diff = buildDiff(sqlite, document); const metadata = { importerVersion: options.importerVersion ?? FOOD_IMPORTER_VERSION };
  if (validation.errors.length) throw new Error("STAGING_DATASET_NOT_VALIDATED");
  const staging = sqlite.prepare("SELECT status FROM food_staging_dataset WHERE id = ?").get(id) as { status: string } | undefined;
  if (staging?.status === "promoted") return { status: "already_promoted", stagingDatasetId: id, validation, diff, metadata };
  if (staging?.status !== "validated") throw new Error("STAGING_DATASET_NOT_VALIDATED");
  const now = options.now(); const newDatasetId = datasetId(document); const active = activeRows(sqlite, document.datasetKey);
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    ensureDefinitions(sqlite);
    sqlite.prepare("INSERT INTO food_dataset (id, dataset_key, version, source_name, source_url, source_notes, checksum, imported_at, promoted_at, status, record_count, validation_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staging', ?, ?, ?)").run(newDatasetId, document.datasetKey, document.version, document.sourceName, document.sourceUrl ?? null, document.sourceNotes ?? null, document.checksum, now, now, document.foods.length, JSON.stringify(validation), JSON.stringify({ ...metadata, diff }));
    if (active) { sqlite.prepare("UPDATE food_dataset SET status = 'archived' WHERE id = ?").run(active.id); sqlite.prepare("UPDATE food_source_record SET is_primary = 0 WHERE dataset_id = ?").run(active.id); }
    let count = 0;
    for (const food of document.foods) {
      const fId = foodId(document, food.foodCode); const sId = sourceId(document, food.foodCode); const canonicalKey = `${namespace(document)}:${food.foodCode}`;
      sqlite.prepare("INSERT INTO food_item (id, canonical_key, primary_name, search_key, english_name, food_code, food_type, default_basis, edible_ratio, source_quality, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'generic', 'edible_100g', ?, 'A', 1, ?, ?) ON CONFLICT(canonical_key) DO UPDATE SET primary_name=excluded.primary_name, search_key=excluded.search_key, english_name=excluded.english_name, food_code=excluded.food_code, edible_ratio=excluded.edible_ratio, active=1, updated_at=excluded.updated_at").run(fId, canonicalKey, food.foodName, food.foodName.trim().replace(/\s+/g, " ").toLowerCase(), food.englishName, food.foodCode, food.edibleRatio, now, now);
      sqlite.prepare("INSERT INTO food_source_record (id, food_id, dataset_id, source_type, source_record_id, raw_json, source_url, source_notes, imported_at, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)").run(sId, fId, newDatasetId, namespace(document), food.foodCode, food.rawJson, document.sourceUrl ?? null, food.remark, now);
      for (const [inputKey, tuple] of Object.entries(NUTRIENTS) as Array<[NutrientInputKey, readonly string[]]>) { const nutrient = food.nutrients[inputKey]!; sqlite.prepare("INSERT INTO food_nutrient_value (id, food_id, source_record_id, nutrient_id, amount_numeric, amount_raw, value_status, basis_amount, basis_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 100, 'g', ?)").run(`${sId}:nutrient:${tuple[0]!}`, fId, sId, tuple[0]!, nutrient.amountNumeric, nutrient.amountRaw, nutrient.valueStatus, now); }
      sqlite.prepare("DELETE FROM food_alias WHERE food_id = ? AND user_defined = 0").run(fId);
      for (const alias of food.aliases) sqlite.prepare("INSERT INTO food_alias (id, food_id, alias, alias_normalized, alias_type, user_defined) VALUES (?, ?, ?, ?, 'synonym', 0)").run(`${sId}:alias:${normalizeAlias(alias)}`, fId, alias, normalizeAlias(alias));
      sqlite.prepare("DELETE FROM food_serving WHERE food_id = ? AND source = 'built_in'").run(fId);
      food.servings.forEach((serving, index) => sqlite.prepare("INSERT INTO food_serving (id, food_id, label, amount, unit, equivalent_g, equivalent_ml, sort_order, source, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'built_in', ?)").run(`${sId}:serving:${index}`, fId, serving.label, serving.amount, serving.unit, serving.unit === "g" ? serving.amount : null, serving.unit === "ml" ? serving.amount : null, index, index === 0 ? 1 : 0));
      count += 1; if (options.failAfterCanonicalRows !== undefined && count >= options.failAfterCanonicalRows) throw new Error("PROMOTE_TEST_FAILURE");
    }
    if (active) { const codes = document.foods.map((food) => food.foodCode); const placeholders = codes.map(() => "?").join(","); sqlite.prepare(`UPDATE food_item SET active = 0 WHERE id IN (SELECT food_id FROM food_source_record WHERE dataset_id = ?) AND food_code NOT IN (${placeholders})`).run(active.id, ...codes); }
    sqlite.prepare("UPDATE food_dataset SET status = 'active' WHERE id = ?").run(newDatasetId);
    sqlite.prepare("UPDATE food_staging_dataset SET status = 'promoted', metadata_json = ? WHERE id = ?").run(JSON.stringify({ ...metadata, diff }), id);
    sqlite.prepare("DELETE FROM food_search_fts").run();
    const activeFoods = sqlite.prepare("SELECT fi.id, fi.primary_name, fi.english_name, COALESCE((SELECT group_concat(alias, ' ') FROM food_alias WHERE food_id = fi.id), '') AS aliases FROM food_item fi WHERE fi.active = 1").all() as Array<{ id: string; primary_name: string; english_name: string | null; aliases: string }>;
    for (const row of activeFoods) sqlite.prepare("INSERT INTO food_search_fts (food_id, primary_name, aliases, english_name, pinyin, brand) VALUES (?, ?, ?, ?, '', '')").run(row.id, row.primary_name, row.aliases, row.english_name ?? "");
    sqlite.exec("COMMIT"); return { status: "promoted", stagingDatasetId: id, validation, diff, metadata };
  } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
}

export function importFoodDataset(sqlite: DatabaseSync, raw: string, options: ImportOptions): ImportResult {
  const metadata = { importerVersion: options.importerVersion ?? FOOD_IMPORTER_VERSION }; const parsed = parseFoodImport(raw);
  if (!parsed.ok) {
    const validation = { errors: parsed.errors, warnings: [] };
    const rawMetadata = extractMetadata(raw);
    if (!rawMetadata) return { status: "failed", validation, diff: emptyDiff(), metadata };
    const stagedId = `staging:${rawMetadata.datasetKey}:${rawMetadata.version}:${rawMetadata.checksum}`;
    const existing = sqlite.prepare("SELECT status FROM food_staging_dataset WHERE id = ?").get(stagedId) as { status: string } | undefined;
    if (existing) {
      return {
        status: existing.status === "promoted" ? "already_promoted" : "already_staged",
        stagingDatasetId: stagedId,
        validation,
        diff: emptyDiff(),
        metadata,
      };
    }
    stageParseFailure(sqlite, raw, rawMetadata, validation, options);
    return { status: "failed", stagingDatasetId: stagedId, validation, diff: emptyDiff(), metadata };
  }
  const id = stagingId(parsed.document);
  const existing = sqlite.prepare("SELECT status FROM food_staging_dataset WHERE dataset_key = ? AND version = ? AND checksum = ?").get(parsed.document.datasetKey, parsed.document.version, parsed.document.checksum) as { status: string } | undefined;
  if (existing) { const validation = validate(parsed.document); return { status: existing.status === "promoted" ? "already_promoted" : "already_staged", stagingDatasetId: id, validation, diff: buildDiff(sqlite, parsed.document), metadata }; }
  const stagedId = stage(sqlite, parsed.document, options); const validation = validate(parsed.document); const diff = buildDiff(sqlite, parsed.document);
  sqlite.prepare("UPDATE food_staging_dataset SET status = ?, validation_json = ?, metadata_json = ? WHERE id = ?").run(validation.errors.length ? "failed" : "validated", JSON.stringify(validation), JSON.stringify({ ...metadata, diff }), stagedId);
  if (validation.errors.length) return { status: "failed", stagingDatasetId: stagedId, validation, diff, metadata };
  if (options.promote === false) return { status: "staged", stagingDatasetId: stagedId, validation, diff, metadata };
  return promoteStagedDataset(sqlite, stagedId, options);
}
