import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

async function json(response: Response) { return await response.json() as Record<string, unknown>; }
function cookie(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

it("supports one-time bootstrap, session login/logout, and protected routes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "auth-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    expect(await json(await fetch(`${base}/api/v1/auth/status`))).toEqual({ data: { initialized: false } });
    expect((await json(await fetch(`${base}/api/v1/dashboard/2026-09-09`))).error).toMatchObject({ code: "AUTH_REQUIRED" });
    const boot = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple", timezone: "Asia/Shanghai" }) });
    expect(boot.status).toBe(201);
    const sessionCookie = cookie(boot);
    expect(sessionCookie).toContain("nutrition_session=");
    expect(await json(boot)).toMatchObject({ data: { user: { displayName: "Owner", timezone: "Asia/Shanghai" } } });
    expect(await json(await fetch(`${base}/api/v1/auth/session`, { headers: { cookie: sessionCookie } }))).toMatchObject({ data: { authenticated: true, user: { displayName: "Owner" } } });
    const duplicate = await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Other", password: "another correct password" }) });
    expect(duplicate.status).toBe(409);
    expect(await json(duplicate)).toMatchObject({ error: { code: "AUTH_BOOTSTRAP_ALREADY_COMPLETED" } });
    expect((await fetch(`${base}/api/v1/dashboard/2026-09-09`, { headers: { cookie: sessionCookie } })).status).toBe(200);
    const logout = await fetch(`${base}/api/v1/auth/logout`, { method: "POST", headers: { cookie: sessionCookie } });
    expect(logout.status).toBe(204);
    expect(await json(await fetch(`${base}/api/v1/auth/session`, { headers: { cookie: sessionCookie } }))).toEqual({ data: { authenticated: false, user: null } });
  } finally { await runtime.close(); }
});

it("uses the same credential error for wrong password", async () => {
  const directory = mkdtempSync(join(tmpdir(), "auth-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    await fetch(`${base}/api/v1/auth/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Owner", password: "correct horse battery staple" }) });
    const response = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "wrong password" }) });
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "AUTH_INVALID_CREDENTIALS" } });
  } finally { await runtime.close(); }
});
