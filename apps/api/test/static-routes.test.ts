import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";
import { bootstrapSession } from "./auth-helper.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

it("serves the built app shell and assets without swallowing API 404s", async () => {
  const directory = mkdtempSync(join(tmpdir(), "static-api-")); directories.push(directory);
  const webDirectory = join(directory, "web");
  const assets = join(webDirectory, "assets");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(webDirectory, "index.html"), "<!doctype html><html><body>app-shell</body></html>");
  writeFileSync(join(assets, "app.js"), "console.log('ok')");
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0, webDistDir: webDirectory });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    expect(await (await fetch(`${base}/`)).text()).toContain("app-shell");
    expect(await (await fetch(`${base}/login`)).text()).toContain("app-shell");
    expect(await (await fetch(`${base}/assets/app.js`)).text()).toContain("console.log");
    const cookie = await bootstrapSession(base);
    const missing = await fetch(`${base}/api/v1/not-real`, { headers: { cookie } });
    expect(missing.status).toBe(404);
  } finally { await runtime.close(); }
});
