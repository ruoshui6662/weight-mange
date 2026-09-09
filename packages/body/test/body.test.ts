import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { BODY_MIGRATIONS, CORE_MIGRATIONS } from "../../db/src/schema.js";
import { BodyError, calculateWeightTrend, createBodyService, sampleDailyWeights } from "../src/index.js";

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

  it("samples same-day observations without inventing missing dates", () => {
    const observations = [
      { localDate: "2026-01-01", measuredAt: 100, weightKg: 70 },
      { localDate: "2026-01-01", measuredAt: 200, weightKg: 69.8 },
      { localDate: "2026-01-03", measuredAt: 300, weightKg: 69 },
    ];
    expect(sampleDailyWeights(observations, "last")).toEqual([
      { localDate: "2026-01-01", weightKg: 69.8, observedCount: 2 },
      { localDate: "2026-01-03", weightKg: 69, observedCount: 1 },
    ]);
    expect(sampleDailyWeights(observations, "average")[0]).toMatchObject({ localDate: "2026-01-01", weightKg: 69.9, observedCount: 2 });
  });

  it("calculates versioned rolling and EWMA trends over calendar windows", () => {
    const points = [
      { localDate: "2026-01-01", weightKg: 70 },
      { localDate: "2026-01-03", weightKg: 69 },
      { localDate: "2026-01-08", weightKg: 68 },
    ];
    expect(calculateWeightTrend({ points, windowDays: 7, method: "rolling" })).toMatchObject({
      methodVersion: "weight_trend_v1",
      points: [
        { localDate: "2026-01-03", weightKg: 69, trendWeightKg: 69.5 },
        { localDate: "2026-01-08", weightKg: 68, trendWeightKg: 68.5 },
      ],
    });
    expect(calculateWeightTrend({ points, windowDays: 14, method: "ewma" })).toMatchObject({
      methodVersion: "weight_trend_v1",
      alpha: 0.25,
      points: [
        { localDate: "2026-01-01", trendWeightKg: 70 },
        { localDate: "2026-01-03", trendWeightKg: 69.75 },
        { localDate: "2026-01-08", trendWeightKg: 69.3125 },
      ],
    });
  });

  it("rejects unsupported trend windows and unstable EWMA parameters", () => {
    const points = [{ localDate: "2026-01-01", weightKg: 70 }];
    expect(() => calculateWeightTrend({ points, windowDays: 10 as never, method: "rolling" })).toThrow(/windowDays/i);
    expect(() => calculateWeightTrend({ points, windowDays: 7, method: "ewma", alpha: 0 })).toThrow(/alpha/i);
    expect(calculateWeightTrend({ points: [], windowDays: 7, method: "rolling" })).toMatchObject({ points: [], observedDays: 0 });
  });
});
