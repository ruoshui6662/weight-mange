import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

async function json(response: Response) { return await response.json() as Record<string, unknown>; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

it("completes the first profile and goal setup after bootstrap", async () => {
  const directory = mkdtempSync(join(tmpdir(), "profile-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple" }) });
    const sessionCookie = cookie(boot);
    const headers = { "content-type": "application/json", cookie: sessionCookie };
    const profile = await fetch(`${base}/api/v1/profile`, { headers });
    expect(profile.status).toBe(200);
    expect(await json(profile)).toMatchObject({ data: { displayName: "Owner", body: null } });
    const updated = await fetch(`${base}/api/v1/profile`, { method: "PATCH", headers, body: JSON.stringify({ displayName: "主人", timezone: "Asia/Shanghai", heightCm: 166, sexForFormula: "none", activityLevel: "light" }) });
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({ data: { displayName: "主人", timezone: "Asia/Shanghai", body: { heightCm: 166 } } });
    const goal = await fetch(`${base}/api/v1/profile/goals`, { method: "POST", headers, body: JSON.stringify({ goalType: "loss", calorieTargetKcal: 1800, proteinTargetG: 120, effectiveFrom: "2026-09-09", source: "manual" }) });
    expect(goal.status).toBe(201);
    expect(await json(goal)).toMatchObject({ data: { goalType: "loss", calorieTargetKcal: 1800 } });
    expect(await json(await fetch(`${base}/api/v1/profile/goals`, { headers }))).toMatchObject({ data: [expect.objectContaining({ effectiveTo: null })] });
    const invalidDate = await fetch(`${base}/api/v1/profile`, { method: "PATCH", headers, body: JSON.stringify({ birthDate: "9999-99-99" }) });
    expect(invalidDate.status).toBe(400);
    expect(await json(invalidDate)).toMatchObject({ error: { code: "PROFILE_INVALID_INPUT" } });
  } finally { await runtime.close(); }
});
