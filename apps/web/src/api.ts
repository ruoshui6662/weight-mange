export type ApiErrorShape = { code: string; message: string; requestId?: string };
export class ApiError extends Error { constructor(readonly code: string, readonly status: number, message = code) { super(message); } }

export type Profile = { id: string; displayName: string; timezone: string; body: { heightCm: number | null; sexForFormula: string | null; activityLevel: string | null } | null };
export type Dashboard = { date: string; goal: { kcal: number; proteinG: number | null; fatG: number | null; carbG: number | null } | null; intake: { kcal: number; proteinG: number; fatG: number; carbG: number }; remainingKcal: number | null; meals: Array<{ key: string; displayName: string; totals: { kcal: number } }> };
export type Diary = {
  mealSlots: Array<{ id: string; key: string; displayName: string }>;
  entries: Array<{ id: string; mealSlotId: string; displayNameSnapshot: string; amount: number; unit: string; version: number }>;
};
export type WeightRecord = { id: string; measuredAt: string; localDate: string; weightKg: number; source: string; note: string | null; version: number };
export type WeightTrend = { methodVersion: string; windowDays: number; method: string; alpha: number; observedDays: number; points: Array<{ localDate: string; weightKg: number; trendWeightKg: number }> };
export type AnalyticsOverview = { period: { from: string; to: string; days: number }; recordCoverage: { recordedDays: number; totalDays: number; ratio: number }; averages: { intakeKcal: number | null; proteinG: number | null; fatG: number | null; carbG: number | null }; goal: { days: number; averageKcal: number | null; averageDifferenceKcal: number | null }; weight: { observedDays: number; startKg: number | null; endKg: number | null; deltaKg: number | null } };
export type TdeeEstimate = { methodVersion: string; status: "estimated" | "insufficient_data" | "throttled"; reason: string | null; rawTdeeKcal: number | null; estimatedTdeeKcal: number | null; confidence: number; recommendedCalorieTargetKcal: null; period: { from: string; to: string } };
export type RecipeNutrientSummary = { amount: number; coverage: number; hasTrace: boolean; hasEstimated: boolean };
export type RecipeWarning = { code: "COOKED_WEIGHT_MISSING" | "SERVING_COUNT_MISSING" | "NUTRIENT_COVERAGE_INCOMPLETE" | "NUTRIENT_TRACE" | "NUTRIENT_ESTIMATED" | "NUTRIENT_UNKNOWN" | "RECIPE_INGREDIENT_REFRESH_UNAVAILABLE"; nutrientId?: string; ingredientId?: string };
export type RecipeIngredient = { id: string; foodId: string | null; servingId: string | null; nameSnapshot: string; inputAmount: number; inputUnit: "g" | "ml" | "serving"; gramEquivalent: number | null; sortOrder: number; sourceSnapshot: Record<string, unknown> | null; nutrients: Array<{ id: string; amountNumeric: number | null; amountRaw: string | null; valueStatus: "known" | "trace" | "unknown" | "estimated" | "not_applicable"; sourceBasisJson: string; nutritionEngineVersion: string }> };
export type Recipe = { id: string; userId: string; name: string; cookedWeightG: number | null; servingCount: number | null; note: string | null; version: number; deletedAt: number | null; createdAt: number; updatedAt: number; ingredients: RecipeIngredient[]; total: Record<string, RecipeNutrientSummary>; per100g: Record<string, RecipeNutrientSummary> | null; perServing: Record<string, RecipeNutrientSummary> | null; warnings: RecipeWarning[]; calcVersion: string };
export type RecipeIngredientInput = { foodId: string; amount: number; unit: "g" | "ml" | "serving"; servingId?: string | null };
export type RecipeCreateInput = { name: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients: RecipeIngredientInput[] };
export type RecipeUpdateInput = { version: number; name?: string; cookedWeightG?: number | null; servingCount?: number | null; note?: string | null; ingredients?: RecipeIngredientInput[] };
export type RecipeClient = {
  getRecipes: () => Promise<Recipe[]>;
  getRecipe: (recipeId: string) => Promise<Recipe>;
  createRecipe: (input: RecipeCreateInput) => Promise<Recipe>;
  updateRecipe: (recipeId: string, input: RecipeUpdateInput) => Promise<Recipe>;
  copyRecipe: (recipeId: string, name?: string) => Promise<Recipe>;
  deleteRecipe: (recipeId: string) => Promise<{ ok: boolean }>;
  refreshRecipeIngredients: (recipeId: string, ingredientIds?: string[]) => Promise<Recipe>;
  addRecipeToDiary: (recipeId: string, input: { date: string; mealSlotId: string; amount: number; unit: "g"; note?: string | null }) => Promise<Record<string, unknown>>;
  searchFoods: (query: string) => Promise<Array<{ id: string; name: string; summary: { energyKcal: number | null } }>>;
};

export function createIdempotencyKey() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);
  return `diary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { credentials: "include", ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as { data?: T; error?: ApiErrorShape };
  if (!response.ok) throw new ApiError(payload.error?.code ?? "REQUEST_FAILED", response.status, payload.error?.message);
  return payload.data as T;
}

export const api = {
  getStatus: () => request<{ initialized: boolean }>("/api/v1/auth/status"),
  getSession: () => request<{ authenticated: boolean; user: Profile | null }>("/api/v1/auth/session"),
  bootstrap: (input: { displayName: string; password: string; timezone: string }) => request<{ user: Profile }>("/api/v1/auth/bootstrap", { method: "POST", body: JSON.stringify(input) }),
  login: (password: string) => request<{ user: Profile }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  getProfile: () => request<Profile>("/api/v1/profile"),
  updateProfile: (input: Record<string, unknown>) => request<Profile>("/api/v1/profile", { method: "PATCH", body: JSON.stringify(input) }),
  getGoals: () => request<Array<Record<string, unknown>>>("/api/v1/profile/goals"),
  createGoal: (input: Record<string, unknown>) => request<Record<string, unknown>>("/api/v1/profile/goals", { method: "POST", body: JSON.stringify(input) }),
  getDashboard: (date: string) => request<Dashboard>(`/api/v1/dashboard/${encodeURIComponent(date)}`),
  getDiary: (date: string) => request<Diary>(`/api/v1/diary/${encodeURIComponent(date)}`),
  getRecipes: () => request<Recipe[]>("/api/v1/recipes"),
  getRecipe: (recipeId: string) => request<Recipe>(`/api/v1/recipes/${encodeURIComponent(recipeId)}`),
  createRecipe: (input: RecipeCreateInput) => request<Recipe>("/api/v1/recipes", { method: "POST", body: JSON.stringify(input) }),
  updateRecipe: (recipeId: string, input: RecipeUpdateInput) => request<Recipe>(`/api/v1/recipes/${encodeURIComponent(recipeId)}`, { method: "PATCH", body: JSON.stringify(input) }),
  copyRecipe: (recipeId: string, name?: string) => request<Recipe>(`/api/v1/recipes/${encodeURIComponent(recipeId)}/copy`, { method: "POST", body: JSON.stringify(name === undefined ? {} : { name }) }),
  deleteRecipe: (recipeId: string) => request<{ ok: boolean }>(`/api/v1/recipes/${encodeURIComponent(recipeId)}`, { method: "DELETE" }),
  refreshRecipeIngredients: (recipeId: string, ingredientIds?: string[]) => request<Recipe>(`/api/v1/recipes/${encodeURIComponent(recipeId)}/refresh-ingredients`, { method: "POST", body: JSON.stringify(ingredientIds === undefined ? {} : { ingredientIds }) }),
  addRecipeToDiary: (recipeId: string, input: { date: string; mealSlotId: string; amount: number; unit: "g"; note?: string | null }) => request<Record<string, unknown>>(`/api/v1/recipes/${encodeURIComponent(recipeId)}/add-to-diary`, { method: "POST", body: JSON.stringify(input) }),
  searchFoods: (query: string) => request<Array<{ id: string; name: string; summary: { energyKcal: number | null } }>>(`/api/v1/foods/search?q=${encodeURIComponent(query)}&limit=10`),
  createDiaryEntry: (date: string, input: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/diary/${encodeURIComponent(date)}/entries`, { method: "POST", headers: { "idempotency-key": createIdempotencyKey() }, body: JSON.stringify(input) }),
  updateDiaryEntry: (date: string, entryId: string, input: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/diary/${encodeURIComponent(date)}/entries/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteDiaryEntry: (date: string, entryId: string) => request<{ ok: boolean }>(`/api/v1/diary/${encodeURIComponent(date)}/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" }),
  copyDiaryMeal: (date: string, input: { fromDate: string; fromMealSlotId: string; toMealSlotId: string }) => request<Record<string, unknown>[]>(`/api/v1/diary/${encodeURIComponent(date)}/copy-meal`, { method: "POST", body: JSON.stringify(input) }),
  copyDiaryDay: (date: string, fromDate: string) => request<Record<string, unknown>[]>(`/api/v1/diary/${encodeURIComponent(date)}/copy-day`, { method: "POST", body: JSON.stringify({ fromDate }) }),
  getWeights: (from: string, to: string) => request<WeightRecord[]>(`/api/v1/body/weights?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createWeight: (input: { measuredAt: string; weightKg: number; note?: string }) => request<WeightRecord>("/api/v1/body/weights", { method: "POST", body: JSON.stringify(input) }),
  getWeightTrend: (days = 30) => request<WeightTrend>(`/api/v1/body/weight-trend?days=${days}&method=ewma&sampling=last`),
  getAnalyticsOverview: (from: string, to: string) => request<AnalyticsOverview>(`/api/v1/analytics/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getTdee: (from: string, to: string) => request<TdeeEstimate>(`/api/v1/analytics/tdee?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};
