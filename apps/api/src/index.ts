import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { applyMigrations, openDatabase } from "@nutrition-tracker/db";
import { ANALYTICS_MIGRATIONS, CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "@nutrition-tracker/db/schema";
import { AuthError, createAuthService, createSqliteAuthStore, sessionCookieOptions } from "@nutrition-tracker/auth";
import { createDashboardService, DashboardError } from "@nutrition-tracker/dashboard";
import { createDiaryService, DiaryError } from "@nutrition-tracker/diary";
import { createFoodCatalog, FoodError } from "@nutrition-tracker/food";
import { createProfileService, ProfileError } from "@nutrition-tracker/profile";

const SESSION_COOKIE = "nutrition_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type ApiOptions = { dbPath: string; port?: number; secureCookies?: boolean; webDistDir?: string };
export type ApiRuntime = { server: Server; port: number; close(): Promise<void> };

class ApiAuthError extends Error {
  constructor(readonly code: "AUTH_REQUIRED" | "AUTH_INVALID_BODY") { super(code); }
}

function writeJson(response: ServerResponse, statusCode: number, body: object, headers: Record<string, string> = {}) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

function writeNoContent(response: ServerResponse, headers: Record<string, string> = {}) {
  response.writeHead(204, headers);
  response.end();
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) body += String(chunk);
  if (!body) return {};
  try {
    const value: unknown = JSON.parse(body);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* handled below */ }
  throw new FoodError("FOOD_INVALID_BODY");
}

function parseCookies(request: IncomingMessage) {
  const header = request.headers.cookie ?? "";
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")]));
}

function sessionCookie(token: string, secure: boolean) {
  const options = sessionCookieOptions(secure);
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=${options.path}; HttpOnly; SameSite=${options.sameSite === "lax" ? "Lax" : "Strict"}${options.secure ? "; Secure" : ""}`;
}

function clearSessionCookie(secure: boolean) {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function serveStatic(response: ServerResponse, pathname: string, webDistDir: string) {
  const root = resolve(webDistDir);
  let relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let shell = relative === "index.html";
  try { relative = decodeURIComponent(relative); } catch { return false; }
  let candidate = resolve(root, relative);
  if (!candidate.startsWith(`${root}/`) && !candidate.startsWith(`${root}\\`)) return false;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    if (extname(relative) !== "") return false;
    candidate = resolve(root, "index.html");
    shell = true;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return false;
  const canonicalRoot = realpathSync(root);
  const canonicalCandidate = realpathSync(candidate);
  if (!canonicalCandidate.startsWith(`${canonicalRoot}/`) && !canonicalCandidate.startsWith(`${canonicalRoot}\\`)) return false;
  const contentTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon" };
  response.writeHead(200, { "content-type": contentTypes[extname(candidate).toLowerCase()] ?? "application/octet-stream", "cache-control": shell ? "no-cache" : "public, max-age=31536000, immutable" });
  response.end(readFileSync(candidate));
  return true;
}

function writeFallbackHome(response: ServerResponse) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end("<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>体重管理服务</title></head><body><main><h1>体重管理服务已启动</h1><p>前端资源尚未构建。</p><p><a href=\"/healthz\">健康检查</a> · <a href=\"/readyz\">就绪检查</a></p></main></body></html>");
}

function foodError(response: ServerResponse, error: unknown, requestId: string) {
  if (!(error instanceof FoodError)) return false;
  const status = error.code === "FOOD_NOT_FOUND" ? 404 : error.code === "FOOD_REFERENCE_READ_ONLY" || error.code.endsWith("_READ_ONLY") || error.code === "FOOD_VERSION_CONFLICT" ? 409 : 400;
  writeJson(response, status, { error: { code: error.code, message: error.code, ...(error.details ? { details: error.details } : {}), requestId } });
  return true;
}

function diaryError(response: ServerResponse, error: unknown, requestId: string) {
  if (!(error instanceof DiaryError)) return false;
  const status = error.code === "DIARY_ENTRY_NOT_FOUND" || error.code === "DIARY_FOOD_NOT_FOUND" ? 404 : error.code === "DIARY_VERSION_CONFLICT" || error.code === "DIARY_IDEMPOTENCY_CONFLICT" ? 409 : 400;
  writeJson(response, status, { error: { code: error.code, message: error.code, ...(error.details ? { details: error.details } : {}), requestId } });
  return true;
}

function dashboardError(response: ServerResponse, error: unknown, requestId: string) {
  if (!(error instanceof DashboardError)) return false;
  writeJson(response, 400, { error: { code: error.code, message: error.code, ...(error.details ? { details: error.details } : {}), requestId } });
  return true;
}

function profileError(response: ServerResponse, error: unknown, requestId: string) {
  if (!(error instanceof ProfileError)) return false;
  const status = error.code === "PROFILE_NOT_FOUND" ? 404 : error.code === "PROFILE_GOAL_CONFLICT" ? 409 : 400;
  writeJson(response, status, { error: { code: error.code, message: error.code, requestId } });
  return true;
}

function authError(response: ServerResponse, error: unknown, requestId: string) {
  if (error instanceof ApiAuthError) {
    writeJson(response, 401, { error: { code: error.code, message: error.code, requestId } });
    return true;
  }
  if (!(error instanceof AuthError)) return false;
  const status = error.code === "AUTH_INVALID_CREDENTIALS" || error.code === "AUTH_SESSION_INVALID" ? 401 : error.code === "AUTH_BOOTSTRAP_ALREADY_COMPLETED" ? 409 : error.code === "AUTH_NOT_INITIALIZED" ? 409 : 400;
  writeJson(response, status, { error: { code: error.code, message: error.code, requestId } });
  return true;
}

export async function startApiServer(options: ApiOptions): Promise<ApiRuntime> {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const { sqlite } = openDatabase(options.dbPath);
  let ready = false;
  const secureCookies = options.secureCookies ?? process.env.AUTH_COOKIE_SECURE === "true";

  try {
    applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS, ...ANALYTICS_MIGRATIONS]);
    const auth = createAuthService(createSqliteAuthStore(sqlite));
    const profile = createProfileService(sqlite);
    const foods = createFoodCatalog(sqlite);
    const diary = createDiaryService(sqlite);
    const dashboard = createDashboardService(sqlite);
    const webDistDir = options.webDistDir ?? process.env.WEB_DIST_DIR ?? "/app/web";
    const server = createServer(async (request, response) => {
      const requestId = randomUUID();
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (request.method === "GET" && url.pathname === "/healthz") { writeJson(response, 200, { status: "ok" }); return; }
        if (request.method === "GET" && url.pathname === "/readyz") { writeJson(response, ready ? 200 : 503, { status: ready ? "ready" : "starting" }); return; }
        if (request.method === "GET" && url.pathname === "/api/v1/auth/status") { writeJson(response, 200, { data: { initialized: auth.isInitialized() } }); return; }
        if (request.method === "GET" && url.pathname === "/api/v1/auth/session") {
          const token = parseCookies(request)[SESSION_COOKIE];
          if (!token) { writeJson(response, 200, { data: { authenticated: false, user: null } }); return; }
          try { const session = auth.verifySession(token); writeJson(response, 200, { data: { authenticated: true, user: profile.getProfile(session.userId) } }); }
          catch (error) { if (error instanceof AuthError) { writeJson(response, 200, { data: { authenticated: false, user: null } }); return; } throw error; }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/auth/bootstrap") {
          const body = await readJson(request);
          const user = auth.bootstrap({ displayName: String(body.displayName ?? ""), password: String(body.password ?? ""), ...(typeof body.timezone === "string" ? { timezone: body.timezone } : {}) });
          const session = auth.login(String(body.password ?? ""));
          writeJson(response, 201, { data: { user: profile.getProfile(user.id) } }, { "set-cookie": sessionCookie(session.token, secureCookies) });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
          if (!auth.isInitialized()) throw new AuthError("AUTH_NOT_INITIALIZED");
          const body = await readJson(request);
          const session = auth.login(String(body.password ?? ""));
          writeJson(response, 200, { data: { user: profile.getProfile(session.userId) } }, { "set-cookie": sessionCookie(session.token, secureCookies) });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/auth/logout") {
          const token = parseCookies(request)[SESSION_COOKIE];
          if (token) auth.logout(token);
          writeNoContent(response, { "set-cookie": clearSessionCookie(secureCookies) });
          return;
        }
        let userId: string | undefined;
        if (url.pathname.startsWith("/api/v1/")) {
          const token = parseCookies(request)[SESSION_COOKIE];
          if (!token) throw new ApiAuthError("AUTH_REQUIRED");
          userId = auth.verifySession(token).userId;
        }
        const foodMatch = /^\/api\/v1\/foods\/([^/]+)$/.exec(url.pathname);
        const servingMatch = /^\/api\/v1\/foods\/([^/]+)\/servings(?:\/([^/]+))?$/.exec(url.pathname);
        const aliasMatch = /^\/api\/v1\/foods\/([^/]+)\/aliases(?:\/([^/]+))?$/.exec(url.pathname);
        const favoriteMatch = /^\/api\/v1\/foods\/([^/]+)\/favorite$/.exec(url.pathname);
        const diaryEntryMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})\/entries(?:\/([^/]+))?$/.exec(url.pathname);
        const diaryMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
        const copyMealMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})\/copy-meal$/.exec(url.pathname);
        const copyDayMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})\/copy-day$/.exec(url.pathname);
        const dashboardMatch = /^\/api\/v1\/dashboard\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
        if (request.method === "GET" && url.pathname === "/api/v1/foods/search") { const limit = Number(url.searchParams.get("limit") ?? "20"); const scope = url.searchParams.get("scope") ?? "all"; writeJson(response, 200, foods.search({ q: url.searchParams.get("q") ?? "", limit, scope: scope as "all" | "local" | "custom", ...(url.searchParams.get("cursor") ? { cursor: url.searchParams.get("cursor")! } : {}) })); return; }
        if (request.method === "POST" && url.pathname === "/api/v1/foods/custom") { const body = await readJson(request); writeJson(response, 201, { data: foods.createCustom(body as Parameters<typeof foods.createCustom>[0]) }); return; }
        if (foodMatch && request.method === "GET") { const detail = foods.detail(decodeURIComponent(foodMatch[1]!)); if (!detail) throw new FoodError("FOOD_NOT_FOUND"); writeJson(response, 200, { data: detail }); return; }
        if (foodMatch && request.method === "PATCH") { const body = await readJson(request); writeJson(response, 200, { data: foods.update(decodeURIComponent(foodMatch[1]!), body as Parameters<typeof foods.update>[1]) }); return; }
        if (favoriteMatch && (request.method === "POST" || request.method === "DELETE")) { foods.setFavorite(decodeURIComponent(favoriteMatch[1]!), request.method === "POST"); writeJson(response, 200, { data: { favorite: request.method === "POST" } }); return; }
        if (servingMatch && request.method === "POST" && !servingMatch[2]) { const body = await readJson(request); writeJson(response, 201, { data: { id: foods.addServing(decodeURIComponent(servingMatch[1]!), body as Parameters<typeof foods.addServing>[1]) } }); return; }
        if (servingMatch && request.method === "PATCH" && servingMatch[2]) { foods.updateServing(decodeURIComponent(servingMatch[1]!), decodeURIComponent(servingMatch[2]), await readJson(request) as Parameters<typeof foods.updateServing>[2]); writeJson(response, 200, { data: { ok: true } }); return; }
        if (servingMatch && request.method === "DELETE" && servingMatch[2]) { foods.deleteServing(decodeURIComponent(servingMatch[1]!), decodeURIComponent(servingMatch[2])); writeJson(response, 200, { data: { ok: true } }); return; }
        if (aliasMatch && request.method === "POST" && !aliasMatch[2]) { const body = await readJson(request); if (typeof body.alias !== "string") throw new FoodError("FOOD_INVALID_ALIAS"); writeJson(response, 201, { data: { id: foods.addAlias(decodeURIComponent(aliasMatch[1]!), body.alias) } }); return; }
        if (aliasMatch && request.method === "DELETE" && aliasMatch[2]) { foods.deleteAlias(decodeURIComponent(aliasMatch[1]!), decodeURIComponent(aliasMatch[2])); writeJson(response, 200, { data: { ok: true } }); return; }
        if (request.method === "GET" && url.pathname === "/api/v1/profile") { writeJson(response, 200, { data: profile.getProfile(userId!) }); return; }
        if (request.method === "PATCH" && url.pathname === "/api/v1/profile") { writeJson(response, 200, { data: profile.updateProfile(userId!, await readJson(request)) }); return; }
        if (request.method === "GET" && url.pathname === "/api/v1/profile/goals") { writeJson(response, 200, { data: profile.listGoals(userId!) }); return; }
        if (request.method === "POST" && url.pathname === "/api/v1/profile/goals/estimate") { writeJson(response, 200, { data: profile.estimateGoal(userId!, await readJson(request)) }); return; }
        if (request.method === "POST" && url.pathname === "/api/v1/profile/goals") { const body = await readJson(request); writeJson(response, 201, { data: profile.createGoal(userId!, body as Parameters<typeof profile.createGoal>[1]) }); return; }
        if (diaryMatch && request.method === "GET") { writeJson(response, 200, { data: diary.getDay({ userId: userId!, date: diaryMatch[1]! }) }); return; }
        if (diaryEntryMatch && request.method === "POST" && !diaryEntryMatch[2]) { const body = await readJson(request); const entry = diary.createEntry({ userId: userId!, date: diaryEntryMatch[1]!, mealSlotId: String(body.mealSlotId ?? ""), foodId: String(body.foodId ?? ""), amount: body.amount as number, unit: body.unit as "g" | "ml" | "serving", ...(typeof body.servingId === "string" ? { servingId: body.servingId } : {}), ...(typeof body.note === "string" ? { note: body.note } : {}), source: body.source as "manual" | "ai_confirmed" | "import", ...(typeof request.headers["idempotency-key"] === "string" ? { idempotencyKey: request.headers["idempotency-key"] } : {}) }); writeJson(response, 201, { data: entry }); return; }
        if (diaryEntryMatch && request.method === "PATCH" && diaryEntryMatch[2]) { const body = await readJson(request); const entry = diary.updateEntry({ userId: userId!, date: diaryEntryMatch[1]!, entryId: decodeURIComponent(diaryEntryMatch[2]), ...(typeof body.amount === "number" ? { amount: body.amount } : {}), ...(typeof body.unit === "string" ? { unit: body.unit as "g" | "ml" | "serving" } : {}), ...(typeof body.mealSlotId === "string" ? { mealSlotId: body.mealSlotId } : {}), ...(typeof body.servingId === "string" ? { servingId: body.servingId } : {}), ...(typeof body.note === "string" ? { note: body.note } : {}), version: body.version as number }); writeJson(response, 200, { data: entry }); return; }
        if (diaryEntryMatch && request.method === "DELETE" && diaryEntryMatch[2]) { diary.deleteEntry({ userId: userId!, date: diaryEntryMatch[1]!, entryId: decodeURIComponent(diaryEntryMatch[2]) }); writeJson(response, 200, { data: { ok: true } }); return; }
        if (copyMealMatch && request.method === "POST") { const body = await readJson(request); const entries = diary.copyMeal({ userId: userId!, date: copyMealMatch[1]!, fromDate: String(body.fromDate ?? ""), fromMealSlotId: String(body.fromMealSlotId ?? ""), toMealSlotId: String(body.toMealSlotId ?? "") }); writeJson(response, 201, { data: entries }); return; }
        if (copyDayMatch && request.method === "POST") { const body = await readJson(request); const entries = diary.copyDay({ userId: userId!, date: copyDayMatch[1]!, fromDate: String(body.fromDate ?? "") }); writeJson(response, 201, { data: entries }); return; }
        if (dashboardMatch && request.method === "GET") { writeJson(response, 200, { data: dashboard.getDashboard({ userId: userId!, date: dashboardMatch[1]! }) }); return; }
        if (request.method === "GET" && !url.pathname.startsWith("/api/")) { if (existsSync(webDistDir) && serveStatic(response, url.pathname, webDistDir)) return; if (url.pathname === "/") { writeFallbackHome(response); return; } }
        writeJson(response, 404, { error: { code: "NOT_FOUND", message: "Not found", requestId } });
      } catch (error) {
        if (!authError(response, error, requestId) && !foodError(response, error, requestId) && !diaryError(response, error, requestId) && !dashboardError(response, error, requestId) && !profileError(response, error, requestId)) writeJson(response, 500, { error: { code: "DATABASE_ERROR", message: "Internal server error", requestId } });
      }
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? Number(process.env.PORT ?? 3000), "0.0.0.0", () => resolve()); });
    ready = true;
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : options.port ?? 3000;
    return { server, port, async close() { ready = false; await new Promise<void>((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error)))); sqlite.close(); } };
  } catch (error) { sqlite.close(); throw error; }
}

async function main() {
  const runtime = await startApiServer({ dbPath: process.env.DB_PATH ?? "/data/db/app.sqlite" });
  console.log(JSON.stringify({ event: "api_started", port: runtime.port }));
  const shutdown = () => { void runtime.close().then(() => process.exit(0)); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
