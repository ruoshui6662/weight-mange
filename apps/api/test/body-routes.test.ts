import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

async function json(response: Response) { return await response.json() as Record<string, unknown>; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

it("records, lists, updates and deletes authenticated body weights", async () => {
  const directory = mkdtempSync(join(tmpdir(), "body-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple" }) });
    const headers = { "content-type": "application/json", cookie: cookie(boot) };
    const profile = await fetch(`${base}/api/v1/profile`, { method: "PATCH", headers, body: JSON.stringify({ timezone: "Asia/Shanghai" }) });
    expect(profile.status).toBe(200);
    const first = await fetch(`${base}/api/v1/body/weights`, { method: "POST", headers, body: JSON.stringify({ measuredAt: "2026-09-08T06:20:00+08:00", weightKg: 55 }) });
    expect(first.status).toBe(201);
    const firstBody = await json(first);
    expect(firstBody).toMatchObject({ data: { localDate: "2026-09-08", weightKg: 55, version: 0 } });
    const second = await fetch(`${base}/api/v1/body/weights`, { method: "POST", headers, body: JSON.stringify({ measuredAt: "2026-09-08T21:20:00+08:00", weightKg: 55.4 }) });
    expect(second.status).toBe(201);
    const listed = await fetch(`${base}/api/v1/body/weights?from=2026-09-08&to=2026-09-08`, { headers });
    expect(listed.status).toBe(200);
    expect((await json(listed)).data).toHaveLength(2);
    const trend = await fetch(`${base}/api/v1/body/weight-trend?days=7&method=ewma`, { headers });
    expect(trend.status).toBe(200);
    expect(await json(trend)).toMatchObject({ data: { methodVersion: "weight_trend_v1", observedDays: 1, points: [{ localDate: "2026-09-08", weightKg: 55.4, trendWeightKg: 55.4 }] } });
    const id = (firstBody.data as { id: string }).id;
    const updated = await fetch(`${base}/api/v1/body/weights/${id}`, { method: "PATCH", headers, body: JSON.stringify({ weightKg: 54.8, version: 0 }) });
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({ data: { weightKg: 54.8, version: 1 } });
    const conflict = await fetch(`${base}/api/v1/body/weights/${id}`, { method: "DELETE", headers, body: JSON.stringify({ version: 0 }) });
    expect(conflict.status).toBe(409);
    const deleted = await fetch(`${base}/api/v1/body/weights/${id}`, { method: "DELETE", headers, body: JSON.stringify({ version: 1 }) });
    expect(deleted.status).toBe(204);
  } finally { await runtime.close(); }
});
