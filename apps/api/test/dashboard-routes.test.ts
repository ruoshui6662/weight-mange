import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

it("returns a single dashboard read model with explicit no-goal fields", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dashboard-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}/api/v1/dashboard/2026-09-09`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { date: "2026-09-09", goal: null, remainingKcal: null, exercise: { available: false }, intake: { kcal: 0 } } });
  } finally { await runtime.close(); }
});

it("rejects an impossible dashboard date with the common error envelope", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dashboard-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}/api/v1/dashboard/2026-02-30`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "DASHBOARD_INVALID_DATE", requestId: expect.any(String) } });
  } finally { await runtime.close(); }
});
