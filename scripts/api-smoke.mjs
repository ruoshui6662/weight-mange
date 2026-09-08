import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startApiServer } from "../apps/api/dist/index.js";

const directory = mkdtempSync(join(tmpdir(), "nutrition-api-smoke-"));
const runtime = await startApiServer({ dbPath: join(directory, "db", "app.sqlite"), port: 0 });
try {
  const health = await globalThis.fetch(`http://127.0.0.1:${runtime.port}/healthz`);
  const readiness = await globalThis.fetch(`http://127.0.0.1:${runtime.port}/readyz`);
  if (health.status !== 200 || readiness.status !== 200) {
    throw new Error(`API_SMOKE_FAILED:${health.status}/${readiness.status}`);
  }
  console.log(`api smoke passed: health=${health.status}, ready=${readiness.status}`);
} finally {
  await runtime.close();
  rmSync(directory, { force: true, recursive: true });
}
