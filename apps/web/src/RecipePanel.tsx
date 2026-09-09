import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { ApiError, type Recipe, type RecipeClient, type RecipeCreateInput, type RecipeNutrientSummary } from "./api";
import { nutrientValue, validateRecipeDraft, warningText, type RecipeDraft, type RecipeDraftIngredient } from "./recipe-ui";

export type RecipePanelProps = {
  today: string;
  client: RecipeClient;
  onDiaryReload: () => Promise<void>;
  onOpenDiary: () => void;
};

type FoodResult = Awaited<ReturnType<RecipeClient["searchFoods"]>>[number];
type RecipeMode = "list" | "editor" | "detail";

let fallbackIngredientRowKey = 0;

export function createIngredientRowKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackIngredientRowKey += 1;
  return `ingredient-row-${fallbackIngredientRowKey}`;
}

const emptyRow = (): RecipeDraftIngredient => ({ key: createIngredientRowKey(), foodId: "", name: "", amount: "100" });
const emptyDraft = (): RecipeDraft => ({ name: "", cookedWeightG: "", servingCount: "", ingredients: [emptyRow()] });
const displayError = (error: unknown) => {
  if (!(error instanceof ApiError)) return "请求未完成，请检查服务状态后重试。";
  if (error.code === "RECIPE_VERSION_CONFLICT") return "菜谱已被更新，请重新加载后再编辑。";
  if (["RECIPE_NOT_FOUND", "RECIPE_FOOD_NOT_FOUND", "RECIPE_INGREDIENT_NOT_FOUND"].includes(error.code)) return "菜谱或原料已不可用，请返回菜谱列表。";
  return error.message || error.code;
};

export const recipeErrorText = displayError;

export function RecipeFoodSearchStatus(props: { searched: boolean; resultCount: number }): ReactElement | null {
  if (!props.searched || props.resultCount > 0) return null;
  return <p className="muted" role="status">没有找到匹配原料</p>;
}

function draftInput(draft: RecipeDraft): RecipeCreateInput {
  return { name: draft.name.trim(), cookedWeightG: draft.cookedWeightG.trim() ? Number(draft.cookedWeightG) : null, servingCount: draft.servingCount.trim() ? Number(draft.servingCount) : null, ingredients: draft.ingredients.map((row) => ({ foodId: row.foodId, amount: Number(row.amount), unit: "g" })) };
}

export async function updateRecipeAction(client: RecipeClient, recipe: Recipe, draft: RecipeDraft): Promise<Recipe> {
  return client.updateRecipe(recipe.id, { ...draftInput(draft), version: recipe.version });
}

export async function copyRecipeAction(client: RecipeClient, recipeId: string): Promise<Recipe> {
  return client.copyRecipe(recipeId);
}

export async function refreshRecipeAction(client: RecipeClient, recipe: Recipe): Promise<Recipe> {
  return client.refreshRecipeIngredients(recipe.id, recipe.ingredients.map((item) => item.id));
}

export async function deleteRecipeAction(client: RecipeClient, recipe: Recipe, confirm: () => boolean): Promise<boolean> {
  if (!confirm()) return false;
  await client.deleteRecipe(recipe.id);
  return true;
}

export async function addRecipeToDiaryAction(client: RecipeClient, recipeId: string, input: { date: string; mealSlotId: string; amount: number; unit: "g" }, onDiaryReload: () => Promise<void>, onOpenDiary: () => void): Promise<void> {
  await client.addRecipeToDiary(recipeId, input);
  await onDiaryReload();
  onOpenDiary();
}

export function RecipePanel(props: RecipePanelProps): ReactElement {
  const [mode, setMode] = useState<RecipeMode>("list");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [foodResults, setFoodResults] = useState<Record<string, FoodResult[]>>({});
  const [searchError, setSearchError] = useState<Record<string, string>>({});
  const [diaryMeal, setDiaryMeal] = useState("breakfast");
  const [diaryAmount, setDiaryAmount] = useState("100");

  async function loadRecipes() {
    setLoading(true);
    setError("");
    try { setRecipes(await props.client.getRecipes()); }
    catch (caught) { setError(displayError(caught)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadRecipes(); }, []);

  function beginCreate() {
    setError(""); setRecipe(null); setDraft(emptyDraft()); setSearches({}); setFoodResults({}); setMode("editor");
  }

  function beginEdit(next: Recipe) {
    setError(""); setRecipe(next); setDraft({ name: next.name, cookedWeightG: next.cookedWeightG === null ? "" : String(next.cookedWeightG), servingCount: next.servingCount === null ? "" : String(next.servingCount), ingredients: next.ingredients.map((item) => ({ key: item.id, foodId: item.foodId ?? "", name: item.nameSnapshot, amount: String(item.inputAmount) })) }); setMode("editor");
  }

  function updateRow(key: string, patch: Partial<RecipeDraftIngredient>) { setDraft((current) => ({ ...current, ingredients: current.ingredients.map((row) => row.key === key ? { ...row, ...patch } : row) })); }

  async function searchFood(event: FormEvent, row: RecipeDraftIngredient) {
    event.preventDefault();
    const query = (searches[row.key] ?? "").trim();
    if (!query) return;
    setSearchError((current) => ({ ...current, [row.key]: "" })); setBusy(`search:${row.key}`);
    try { const results = await props.client.searchFoods(query); setFoodResults((current) => ({ ...current, [row.key]: results })); }
    catch (caught) { setSearchError((current) => ({ ...current, [row.key]: displayError(caught) })); }
    finally { setBusy(null); }
  }

  function chooseFood(row: RecipeDraftIngredient, food: FoodResult) { updateRow(row.key, { foodId: food.id, name: food.name }); setFoodResults((current) => ({ ...current, [row.key]: [] })); }

  async function save(event: FormEvent) {
    event.preventDefault();
    const validation = validateRecipeDraft(draft);
    if (validation) { setError(({ NAME_REQUIRED: "请输入菜谱名称。", INGREDIENT_REQUIRED: "至少添加一项原料。", INGREDIENT_FOOD_REQUIRED: "请选择原料。", INGREDIENT_AMOUNT_INVALID: "原料用量必须为正数。", COOKED_WEIGHT_INVALID: "成品重量必须为正数。", SERVING_COUNT_INVALID: "份数必须为正数。" })[validation]); return; }
    const input = draftInput(draft);
    setBusy("save"); setError("");
    try {
      const next = recipe ? await updateRecipeAction(props.client, recipe, draft) : await props.client.createRecipe(input);
      setRecipe(next); setRecipes((current) => recipe ? current.map((item) => item.id === next.id ? next : item) : [next, ...current]); setMode("detail");
    } catch (caught) { setError(displayError(caught)); }
    finally { setBusy(null); }
  }

  async function copyRecipe() { if (!recipe) return; setBusy("copy"); setError(""); try { const copied = await copyRecipeAction(props.client, recipe.id); setRecipe(copied); setRecipes((current) => [copied, ...current]); setMode("detail"); } catch (caught) { setError(displayError(caught)); } finally { setBusy(null); } }
  async function refreshRecipe() { if (!recipe) return; setBusy("refresh"); setError(""); try { const next = await refreshRecipeAction(props.client, recipe); setRecipe(next); setRecipes((current) => current.map((item) => item.id === next.id ? next : item)); } catch (caught) { setError(displayError(caught)); } finally { setBusy(null); } }
  async function deleteRecipe() { if (!recipe) return; setBusy("delete"); setError(""); try { const deleted = await deleteRecipeAction(props.client, recipe, () => typeof window === "undefined" || window.confirm(`删除“${recipe.name}”？`)); if (deleted) { setRecipes((current) => current.filter((item) => item.id !== recipe.id)); setRecipe(null); setMode("list"); } } catch (caught) { setError(displayError(caught)); } finally { setBusy(null); } }
  async function addToDiary(event: FormEvent) { event.preventDefault(); if (!recipe) return; setBusy("diary"); setError(""); try { await addRecipeToDiaryAction(props.client, recipe.id, { date: props.today, mealSlotId: diaryMeal, amount: Number(diaryAmount), unit: "g" }, props.onDiaryReload, props.onOpenDiary); } catch (caught) { setError(displayError(caught)); } finally { setBusy(null); } }

  const header = <div className="section-heading"><div><h2>菜谱</h2><p className="muted">使用本地食物快照组合和复用菜谱。</p></div><button type="button" className="primary" onClick={beginCreate} disabled={loading || busy !== null}>新建菜谱</button></div>;
  if (mode === "editor") return <section className="card add-card">{header}<form className="form" onSubmit={(event) => void save(event)}><label className="field"><span>菜谱名称</span><input aria-label="菜谱名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field"><span>成品重量（g，可选）</span><input aria-label="成品重量" type="number" min="0" step="0.1" value={draft.cookedWeightG} onChange={(event) => setDraft({ ...draft, cookedWeightG: event.target.value })} /></label><label className="field"><span>份数（可选）</span><input aria-label="份数" type="number" min="0" step="0.1" value={draft.servingCount} onChange={(event) => setDraft({ ...draft, servingCount: event.target.value })} /></label><h3>原料</h3>{draft.ingredients.map((row) => <div className="card" key={row.key}><label className="field"><span>原料名称</span><input aria-label="原料搜索" value={searches[row.key] ?? row.name} onChange={(event) => setSearches((current) => ({ ...current, [row.key]: event.target.value }))} /></label><div className="entry-actions"><button type="button" className="soft-button" disabled={busy === `search:${row.key}`} onClick={(event) => void searchFood(event, row)}>搜索原料</button>{draft.ingredients.length > 1 ? <button type="button" className="soft-button" onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((item) => item.key !== row.key) }))}>删除原料</button> : null}</div>{(foodResults[row.key] ?? []).map((food) => <button type="button" className="food-result" key={food.id} aria-label="选择原料" onClick={() => chooseFood(row, food)}><span>{food.name}</span><small>{food.summary.energyKcal ?? "—"} kcal / 100g</small></button>)}<RecipeFoodSearchStatus searched={foodResults[row.key] !== undefined} resultCount={(foodResults[row.key] ?? []).length} />{searchError[row.key] ? <p className="error" role="alert">{searchError[row.key]}</p> : null}<label className="field"><span>用量（g）</span><input aria-label="原料用量" type="number" min="0" step="0.1" value={row.amount} onChange={(event) => updateRow(row.key, { amount: event.target.value })} /></label><p className="muted">已选：{row.name || "尚未选择"}</p></div>)}<button type="button" className="soft-button" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, emptyRow()] }))}>添加原料</button>{error ? <p className="error" role="alert">{error}</p> : null}<button type="submit" className="primary" disabled={busy !== null}>{busy === "save" ? "保存中…" : "保存菜谱"}</button><button type="button" className="soft-button" onClick={() => { setMode(recipe ? "detail" : "list"); setError(""); }}>取消</button></form></section>;

  if (mode === "detail" && recipe) return <section className="card add-card">{header}<div className="section-heading"><h2>{recipe.name}</h2><span className="status-chip">计算版本 {recipe.calcVersion}</span></div><div className="entry-actions"><button type="button" className="soft-button" disabled={busy !== null} onClick={() => beginEdit(recipe)}>编辑菜谱</button><button type="button" className="soft-button" disabled={busy !== null} onClick={() => void copyRecipe()}>复制菜谱</button><button type="button" className="soft-button" disabled={busy !== null} onClick={() => void refreshRecipe()}>刷新原料</button><button type="button" className="soft-button" disabled={busy !== null} onClick={() => void deleteRecipe()}>删除菜谱</button></div><p className="muted">原料：{recipe.ingredients.map((item) => `${item.nameSnapshot} ${item.inputAmount}${item.inputUnit}`).join("、")}</p><NutrientSection title="总营养" values={recipe.total} /><NutrientSection title="每100克营养" values={recipe.per100g} /><NutrientSection title="每份营养" values={recipe.perServing} />{recipe.warnings.length > 0 ? <div role="note"><h3>数据提示</h3><ul>{recipe.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warningText(warning)}</li>)}</ul></div> : null}<form className="add-form" onSubmit={(event) => void addToDiary(event)}><h3>加入日记</h3><label className="field"><span>餐次</span><select aria-label="餐次" value={diaryMeal} onChange={(event) => setDiaryMeal(event.target.value)}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><label className="field"><span>用量（g）</span><input aria-label="日记用量" type="number" min="1" step="0.1" value={diaryAmount} onChange={(event) => setDiaryAmount(event.target.value)} /></label><button type="submit" className="primary" disabled={busy !== null}>{busy === "diary" ? "加入中…" : "加入日记"}</button></form>{error ? <p className="error" role="alert">{error}</p> : null}<button type="button" className="soft-button" onClick={() => { setRecipe(null); setMode("list"); }}>返回菜谱列表</button></section>;

  return <section className="card add-card">{header}<RecipeListStatus loading={loading} error={error} hasRecipes={recipes.length > 0} onRetry={() => void loadRecipes()} />{!loading && recipes.length > 0 ? <div className="meals">{recipes.map((item) => <article className="meal" key={item.id}><div className="meal-content"><h3>{item.name}</h3><p className="muted">{item.cookedWeightG === null ? "未填写成品重量" : `${item.cookedWeightG}g`} · {item.servingCount === null ? "未填写份数" : `${item.servingCount}份`} · {item.warnings.length} 条提示</p></div><div className="entry-actions"><button type="button" className="soft-button" onClick={() => { setRecipe(item); setMode("detail"); }}>查看菜谱</button><button type="button" className="soft-button" onClick={() => beginEdit(item)}>编辑菜谱</button></div></article>)}</div> : null}</section>;
}

export function RecipeListStatus(props: { loading: boolean; error: string; hasRecipes: boolean; onRetry: () => void }): ReactElement | null {
  if (props.loading) return <p className="loading" role="status">正在加载菜谱…</p>;
  if (props.error) return <div className={props.hasRecipes ? "error" : "empty-state"} role="alert"><strong>菜谱服务暂时不可用</strong><p>{props.error}</p><button type="button" className="soft-button" onClick={props.onRetry}>重试</button></div>;
  if (!props.hasRecipes) return <div className="empty-state" role="status"><strong>还没有菜谱</strong><p>创建第一个菜谱，之后可以快速加入日记。</p></div>;
  return null;
}

function NutrientSection(props: { title: string; values: Record<string, RecipeNutrientSummary> | null }) {
  return <section className="card"><h3>{props.title}</h3>{props.values === null ? <p className="muted">暂无此项营养结果：—</p> : <div className="macro-grid">{Object.entries(props.values).map(([id, summary]) => <div className="metric" key={id}><span className="muted">{id}</span><strong>{nutrientValue(summary)}</strong>{summary.coverage < 1 ? <small>数据覆盖不完整</small> : null}{summary.hasTrace ? <small>微量值</small> : null}{summary.hasEstimated ? <small>估算值</small> : null}</div>)}</div>}</section>;
}
