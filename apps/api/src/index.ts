import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { applyMigrations, openDatabase } from "@nutrition-tracker/db";
import { CORE_MIGRATIONS, DIARY_MIGRATIONS, FOOD_MIGRATIONS } from "@nutrition-tracker/db/schema";
import { createFoodCatalog, FoodError } from "@nutrition-tracker/food";
import { createDiaryService, DiaryError } from "@nutrition-tracker/diary";

export type ApiOptions = {
  dbPath: string;
  port?: number;
};

export type ApiRuntime = {
  server: Server;
  port: number;
  close(): Promise<void>;
};

function writeJson(response: ServerResponse, statusCode: number, body: object) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function writeHome(response: ServerResponse) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>体重管理服务</title>
    <style>
      body { margin: 0; padding: 3rem 1.5rem; color: #24313a; background: #f5f7f8; font-family: system-ui, sans-serif; }
      main { max-width: 38rem; margin: 0 auto; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 0.5rem 2rem rgb(36 49 58 / 10%); }
      h1 { margin-top: 0; font-size: 1.6rem; }
      a { color: #176b87; }
    </style>
  </head>
  <body>
    <main>
      <h1>体重管理服务已启动</h1>
      <p>API 容器运行正常。业务界面将在后续版本提供。</p>
      <p><a href="/healthz">健康检查</a> · <a href="/readyz">就绪检查</a></p>
    </main>
  </body>
</html>`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) body += String(chunk);
  if (!body) return {};
  try { const value: unknown = JSON.parse(body); if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>; } catch { /* fall through */ }
  throw new FoodError("FOOD_INVALID_BODY");
}

function foodError(response: ServerResponse, error: unknown, requestId: string) {
  if (error instanceof FoodError) {
    const status = error.code === "FOOD_NOT_FOUND" ? 404 : error.code === "FOOD_REFERENCE_READ_ONLY" || error.code.endsWith("_READ_ONLY") || error.code === "FOOD_VERSION_CONFLICT" ? 409 : 400;
    writeJson(response, status, { error: { code: error.code, message: error.code, ...(error.details ? { details: error.details } : {}), requestId } }); return true;
  }
  return false;
}

function diaryError(response: ServerResponse, error: unknown, requestId: string) {
  if (error instanceof DiaryError) {
    const status = error.code === "DIARY_ENTRY_NOT_FOUND" || error.code === "DIARY_FOOD_NOT_FOUND" ? 404 : error.code === "DIARY_VERSION_CONFLICT" || error.code === "DIARY_IDEMPOTENCY_CONFLICT" ? 409 : 400;
    writeJson(response, status, { error: { code: error.code, message: error.code, ...(error.details ? { details: error.details } : {}), requestId } }); return true;
  }
  return false;
}

export async function startApiServer(options: ApiOptions): Promise<ApiRuntime> {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const { sqlite } = openDatabase(options.dbPath);
  let ready = false;

  try {
    applyMigrations(sqlite, [...CORE_MIGRATIONS, ...FOOD_MIGRATIONS, ...DIARY_MIGRATIONS]);
    sqlite.prepare("INSERT OR IGNORE INTO profile_user (id,display_name,timezone,created_at,updated_at) VALUES ('local-user','Local user','UTC',?,?)").run(Date.now(), Date.now());
    const foods = createFoodCatalog(sqlite);
    const diary = createDiaryService(sqlite);
    const server = createServer(async (request, response) => {
      const requestId = randomUUID();
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        const foodMatch = /^\/api\/v1\/foods\/([^/]+)$/.exec(url.pathname);
        const servingMatch = /^\/api\/v1\/foods\/([^/]+)\/servings(?:\/([^/]+))?$/.exec(url.pathname);
        const aliasMatch = /^\/api\/v1\/foods\/([^/]+)\/aliases(?:\/([^/]+))?$/.exec(url.pathname);
        const favoriteMatch = /^\/api\/v1\/foods\/([^/]+)\/favorite$/.exec(url.pathname);
        const diaryEntryMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})\/entries(?:\/([^/]+))?$/.exec(url.pathname);
        const diaryMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
        const copyMealMatch = /^\/api\/v1\/diary\/(\d{4}-\d{2}-\d{2})\/copy-meal$/.exec(url.pathname);
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
        if (diaryMatch && request.method === "GET") { writeJson(response, 200, { data: diary.getDay({ userId: "local-user", date: diaryMatch[1]! }) }); return; }
        if (diaryEntryMatch && request.method === "POST" && !diaryEntryMatch[2]) { const body = await readJson(request); const entry = diary.createEntry({ userId: "local-user", date: diaryEntryMatch[1]!, mealSlotId: String(body.mealSlotId ?? ""), foodId: String(body.foodId ?? ""), amount: body.amount as number, unit: body.unit as "g" | "ml" | "serving", ...(typeof body.servingId === "string" ? { servingId: body.servingId } : {}), ...(typeof body.note === "string" ? { note: body.note } : {}), source: body.source as "manual" | "ai_confirmed" | "import", ...(typeof request.headers["idempotency-key"] === "string" ? { idempotencyKey: request.headers["idempotency-key"] } : {}) }); writeJson(response, 201, { data: entry }); return; }
        if (diaryEntryMatch && request.method === "PATCH" && diaryEntryMatch[2]) { const body = await readJson(request); const entry = diary.updateEntry({ userId: "local-user", date: diaryEntryMatch[1]!, entryId: decodeURIComponent(diaryEntryMatch[2]), ...(typeof body.amount === "number" ? { amount: body.amount } : {}), ...(typeof body.unit === "string" ? { unit: body.unit as "g" | "ml" | "serving" } : {}), ...(typeof body.mealSlotId === "string" ? { mealSlotId: body.mealSlotId } : {}), ...(typeof body.servingId === "string" ? { servingId: body.servingId } : {}), ...(typeof body.note === "string" ? { note: body.note } : {}), version: body.version as number }); writeJson(response, 200, { data: entry }); return; }
        if (diaryEntryMatch && request.method === "DELETE" && diaryEntryMatch[2]) { diary.deleteEntry({ userId: "local-user", date: diaryEntryMatch[1]!, entryId: decodeURIComponent(diaryEntryMatch[2]) }); writeJson(response, 200, { data: { ok: true } }); return; }
        if (copyMealMatch && request.method === "POST") { const body = await readJson(request); const entries = diary.copyMeal({ userId: "local-user", date: copyMealMatch[1]!, fromDate: String(body.fromDate ?? ""), fromMealSlotId: String(body.fromMealSlotId ?? ""), toMealSlotId: String(body.toMealSlotId ?? "") }); writeJson(response, 201, { data: entries }); return; }
      if (request.method === "GET" && request.url === "/") {
        writeHome(response);
        return;
      }
      if (request.method === "GET" && request.url === "/healthz") {
        writeJson(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "GET" && request.url === "/readyz") {
        writeJson(response, ready ? 200 : 503, { status: ready ? "ready" : "starting" });
        return;
      }
      writeJson(response, 404, { error: { code: "NOT_FOUND", message: "Not found", requestId } });
      } catch (error) { if (!foodError(response, error, requestId) && !diaryError(response, error, requestId)) writeJson(response, 500, { error: { code: "DATABASE_ERROR", message: "Internal server error", requestId } }); }
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? Number(process.env.PORT ?? 3000), "0.0.0.0", () => resolve());
    });
    ready = true;
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : options.port ?? 3000;
    return {
      server,
      port,
      async close() {
        ready = false;
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        });
        sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

async function main() {
  const runtime = await startApiServer({
    dbPath: process.env.DB_PATH ?? "/data/db/app.sqlite",
  });
  console.log(JSON.stringify({ event: "api_started", port: runtime.port }));
  const shutdown = () => {
    void runtime.close().then(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
