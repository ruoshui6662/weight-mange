import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

async function json(response: Response) { return await response.json() as Record<string, unknown>; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

it("returns an explicit analytics overview for an authenticated period", async () => {
  const directory = mkdtempSync(join(tmpdir(), "analytics-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple" }) });
    const response = await fetch(`${base}/api/v1/analytics/overview?from=2026-01-01&to=2026-01-03`, { headers: { cookie: cookie(boot) } });
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ data: { period: { days: 3 }, recordCoverage: { recordedDays: 0, ratio: 0 }, averages: { intakeKcal: null }, weight: { deltaKg: null } } });
  } finally { await runtime.close(); }
});
