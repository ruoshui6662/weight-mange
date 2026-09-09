import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

type JsonRecord = Record<string, unknown>;
async function json(response: Response) { return await response.json() as JsonRecord; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

it("creates, reads, copies, refreshes, adds, updates, and deletes an authenticated recipe", async () => {
  const directory = mkdtempSync(join(tmpdir(), "recipe-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple" }) });
    const headers = { "content-type": "application/json", cookie: cookie(boot) };
    const foodResponse = await fetch(`${base}/api/v1/foods/custom`, { method: "POST", headers, body: JSON.stringify({ name: "豆浆", nutrients: { energyKcal: 30, proteinG: 2 } }) });
    expect(foodResponse.status).toBe(201);
    const foodId = ((await json(foodResponse)).data as JsonRecord).id as string;
    const created = await fetch(`${base}/api/v1/recipes`, { method: "POST", headers, body: JSON.stringify({ name: "早餐菜谱", cookedWeightG: 200, servingCount: 2, ingredients: [{ foodId, amount: 100, unit: "g" }] }) });
    expect(created.status).toBe(201);
    const createdBody = await json(created);
    expect(createdBody).toMatchObject({ data: { name: "早餐菜谱", calcVersion: "recipe_yield_v1", version: 1, total: { energy_kcal: { amount: 30 } } } });
    const recipeId = (createdBody.data as JsonRecord).id as string;
    const listed = await fetch(`${base}/api/v1/recipes`, { headers });
    expect(listed.status).toBe(200);
    expect((await json(listed)).data as unknown[]).toHaveLength(1);
    const copied = await fetch(`${base}/api/v1/recipes/${recipeId}/copy`, { method: "POST", headers, body: JSON.stringify({ name: "早餐副本" }) });
    expect(copied.status).toBe(201);
    expect(((await json(copied)).data as JsonRecord).name).toBe("早餐副本");
    const updated = await fetch(`${base}/api/v1/recipes/${recipeId}`, { method: "PATCH", headers, body: JSON.stringify({ name: "早餐菜谱（改）", version: 1 }) });
    expect(updated.status).toBe(200);
    expect(((await json(updated)).data as JsonRecord).version).toBe(2);
    const conflict = await fetch(`${base}/api/v1/recipes/${recipeId}`, { method: "PATCH", headers, body: JSON.stringify({ name: "冲突", version: 1 }) });
    expect(conflict.status).toBe(409);
    const refreshed = await fetch(`${base}/api/v1/recipes/${recipeId}/refresh-ingredients`, { method: "POST", headers, body: JSON.stringify({}) });
    expect(refreshed.status).toBe(200);
    const diary = await fetch(`${base}/api/v1/recipes/${recipeId}/add-to-diary`, { method: "POST", headers, body: JSON.stringify({ date: "2026-09-09", mealSlotId: "dinner", amount: 165, unit: "g" }) });
    expect(diary.status).toBe(201);
    expect(((await json(diary)).data as JsonRecord).recipeId).toBe(recipeId);
    const removed = await fetch(`${base}/api/v1/recipes/${recipeId}`, { method: "DELETE", headers });
    expect(removed.status).toBe(200);
    expect(((await json(removed)).data as JsonRecord).ok).toBe(true);
    expect((await fetch(`${base}/api/v1/recipes/${recipeId}`, { headers })).status).toBe(404);
  } finally { await runtime.close(); }
});
