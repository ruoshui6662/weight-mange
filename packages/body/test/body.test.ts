import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { BODY_MIGRATIONS, CORE_MIGRATIONS } from "../../db/src/schema.js";
import { BodyError, createBodyService } from "../src/index.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function createService() {
  const directory = mkdtempSync(join(tmpdir(), "nutrition-body-"));
  directories.push(directory);
  const { sqlite } = openDatabase(join(directory, "app.sqlite"));
  applyMigrations(sqlite, [...CORE_MIGRATIONS, ...BODY_MIGRATIONS], { now: () => 1000 });
  sqlite.prepare("INSERT INTO profile_user (id, display_name, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run("user-1", "Owner", "Asia/Shanghai", 1000, 1000);
  let sequence = 0;
  return { sqlite, body: createBodyService(sqlite, { now: () => 2000, id: () => `weight-${++sequence}` }) };
}

describe("body weight records", () => {
  it("stores multiple same-day measurements and derives the profile timezone date", () => {
    const { sqlite, body } = createService();
    const first = body.createWeight({ userId: "user-1", measuredAt: "2026-09-08T06:20:00+08:00", weightKg: 55, note: "起床后" });
    const second = body.createWeight({ userId: "user-1", measuredAt: "2026-09-08T21:20:00+08:00", weightKg: 55.4 });
    expect(first).toMatchObject({ id: "weight-1", localDate: "2026-09-08", weightKg: 55, version: 0 });
    expect(body.listWeights({ userId: "user-1" })).toHaveLength(2);
    expect(second.id).not.toBe(first.id);
    sqlite.close();
  });

  it("updates and deletes with optimistic version checks", () => {
    const { sqlite, body } = createService();
    const created = body.createWeight({ userId: "user-1", measuredAt: "2026-09-08T06:20:00+08:00", weightKg: 55 });
    const updated = body.updateWeight({ userId: "user-1", id: created.id, weightKg: 54.8, version: 0 });
    expect(updated).toMatchObject({ id: created.id, weightKg: 54.8, version: 1 });
    expect(() => body.updateWeight({ userId: "user-1", id: created.id, weightKg: 54.7, version: 0 })).toThrow(new BodyError("BODY_VERSION_CONFLICT"));
    expect(() => body.deleteWeight({ userId: "user-1", id: created.id, version: 0 })).toThrow(new BodyError("BODY_VERSION_CONFLICT"));
    body.deleteWeight({ userId: "user-1", id: created.id, version: 1 });
    expect(body.listWeights({ userId: "user-1" })).toEqual([]);
    sqlite.close();
  });

  it("rejects invalid timestamps, weights and cross-user access", () => {
    const { sqlite, body } = createService();
    expect(() => body.createWeight({ userId: "user-1", measuredAt: "2026-09-08", weightKg: 55 })).toThrow(new BodyError("BODY_INVALID_INPUT"));
    expect(() => body.createWeight({ userId: "user-1", measuredAt: "2026-09-08T06:20:00+08:00", weightKg: 0 })).toThrow(new BodyError("BODY_INVALID_INPUT"));
    const created = body.createWeight({ userId: "user-1", measuredAt: "2026-09-08T06:20:00+08:00", weightKg: 55 });
    expect(() => body.updateWeight({ userId: "other-user", id: created.id, weightKg: 54, version: 0 })).toThrow(new BodyError("BODY_NOT_FOUND"));
    sqlite.close();
  });
});
