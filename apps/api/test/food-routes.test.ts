import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { startApiServer } from "../src/index.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

it("exposes local-only food routes and stable error envelopes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "food-api-")); directories.push(directory);
  const runtime = await startApiServer({ dbPath: join(directory, "app.sqlite"), port: 0 });
  try {
    const base = `http://127.0.0.1:${runtime.port}`;
    expect((await fetch(`${base}/api/v1/foods/search?q=not-found`)).status).toBe(200);
    expect(await (await fetch(`${base}/api/v1/foods/search?q=not-found`)).json()).toMatchObject({ data: [] });
    const create = await fetch(`${base}/api/v1/foods/custom`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "我的豆浆", nutrients: { energyKcal: 30, proteinG: 2 } }) });
    expect(create.status).toBe(201); const created = await create.json() as { data: { id: string } };
    expect((await fetch(`${base}/api/v1/foods/search?q=豆浆&scope=custom`)).status).toBe(200);
    expect((await fetch(`${base}/api/v1/foods/${created.data.id}/favorite`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/foods/missing`)).status).toBe(404);
    expect((await fetch(`${base}/api/v1/foods/search?q=x&limit=500`)).status).toBe(400);
  } finally { await runtime.close(); }
});
