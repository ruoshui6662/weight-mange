export type ApiErrorShape = { code: string; message: string; requestId?: string };
export class ApiError extends Error { constructor(readonly code: string, readonly status: number, message = code) { super(message); } }

export type Profile = { id: string; displayName: string; timezone: string; body: { heightCm: number | null; sexForFormula: string | null; activityLevel: string | null } | null };
export type Dashboard = { date: string; goal: { kcal: number; proteinG: number | null; fatG: number | null; carbG: number | null } | null; intake: { kcal: number; proteinG: number; fatG: number; carbG: number }; remainingKcal: number | null; meals: Array<{ key: string; displayName: string; totals: { kcal: number } }> };
export type Diary = { meals: Array<{ mealSlot: { key: string; displayName: string }; entries: Array<{ id: string; displayName: string; amount: number; unit: string }> }> };

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
  searchFoods: (query: string) => request<{ data: Array<{ id: string; name: string; summary: { energyKcal: number | null } }>; meta: { nextCursor: string | null } }>(`/api/v1/foods/search?q=${encodeURIComponent(query)}&limit=10`),
  createDiaryEntry: (date: string, input: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/diary/${encodeURIComponent(date)}/entries`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input) }),
};
