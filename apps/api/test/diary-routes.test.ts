import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";
import { bootstrapSession, withCookie } from "./auth-helper.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

it("exposes diary writes with nested validation and optimistic conflict envelopes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "diary-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const cookie = await bootstrapSession(base);
    const food = await fetch(`${base}/api/v1/foods/custom`, { method: "POST", headers: withCookie(cookie, { "content-type": "application/json" }), body: JSON.stringify({ name: "路由豆浆", nutrients: { energyKcal: 30, proteinG: 2 } }) });
    const { data: { id: foodId } } = await food.json() as { data: { id: string } };
    const created = await fetch(`${base}/api/v1/diary/2026-09-09/entries`, { method: "POST", headers: withCookie(cookie, { "content-type": "application/json", "idempotency-key": "route-entry" }), body: JSON.stringify({ mealSlotId: "breakfast", foodId, amount: 50, unit: "g", source: "manual" }) });
    expect(created.status).toBe(201); const entry = await created.json() as { data: { id: string; version: number } };
    expect((await fetch(`${base}/api/v1/diary/2026-09-09`, { headers: withCookie(cookie) })).status).toBe(200);
    const stale = await fetch(`${base}/api/v1/diary/2026-09-09/entries/${entry.data.id}`, { method: "PATCH", headers: withCookie(cookie, { "content-type": "application/json" }), body: JSON.stringify({ amount: 20, version: 0 }) });
    expect(stale.status).toBe(409); expect(await stale.json()).toMatchObject({ error: { code: "DIARY_VERSION_CONFLICT", requestId: expect.any(String) } });
    const copyDay = await fetch(`${base}/api/v1/diary/2026-09-10/copy-day`, { method: "POST", headers: withCookie(cookie, { "content-type": "application/json" }), body: JSON.stringify({ fromDate: "2026-09-09" }) });
    expect(copyDay.status).toBe(201); expect(await copyDay.json()).toMatchObject({ data: [expect.objectContaining({ entrySource: "copy" })] });
    const invalid = await fetch(`${base}/api/v1/diary/2026-09-09/entries`, { method: "POST", headers: withCookie(cookie, { "content-type": "application/json" }), body: "{}" });
    expect(invalid.status).toBe(400); expect(await invalid.json()).toMatchObject({ error: { code: "DIARY_INVALID_ENTRY", requestId: expect.any(String) } });
  } finally { await runtime.close(); }
});
