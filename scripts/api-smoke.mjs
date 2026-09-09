import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startApiServer } from "../apps/api/dist/index.js";

const directory = mkdtempSync(join(tmpdir(), "nutrition-api-smoke-"));
const webDistDir = join(process.cwd(), "apps", "web", "dist");
const runtime = await startApiServer({ dbPath: join(directory, "db", "app.sqlite"), port: 0, webDistDir });
try {
  const home = await globalThis.fetch(`http://127.0.0.1:${runtime.port}/`);
  const health = await globalThis.fetch(`http://127.0.0.1:${runtime.port}/healthz`);
  const readiness = await globalThis.fetch(`http://127.0.0.1:${runtime.port}/readyz`);
  const homeText = await home.text();
  if (home.status !== 200 || health.status !== 200 || readiness.status !== 200 || !homeText.includes("id=\"root\"")) {
    throw new Error(`API_SMOKE_FAILED:${home.status}/${health.status}/${readiness.status}`);
  }
  console.log(`api smoke passed: home=${home.status}, health=${health.status}, ready=${readiness.status}`);
} finally {
  await runtime.close();
  rmSync(directory, { force: true, recursive: true });
}
