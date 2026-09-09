import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { CORE_MIGRATIONS } from "../../db/src/schema.js";
import { ProfileError, createProfileService } from "../src/index.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function createService() {
  const directory = mkdtempSync(join(tmpdir(), "nutrition-profile-"));
  directories.push(directory);
  const { sqlite } = openDatabase(join(directory, "app.sqlite"));
  applyMigrations(sqlite, CORE_MIGRATIONS, { now: () => 1000 });
  sqlite.prepare("INSERT INTO profile_user (id, display_name, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run("user-1", "Owner", "UTC", 1000, 1000);
  return { sqlite, profile: createProfileService(sqlite) };
}

describe("profile and nutrition goals", () => {
  it("returns profile defaults and upserts body profile fields", () => {
    const { sqlite, profile } = createService();
    expect(profile.getProfile("user-1")).toMatchObject({ id: "user-1", displayName: "Owner", timezone: "UTC", body: null });
    expect(profile.updateProfile("user-1", { displayName: " New name ", timezone: "Asia/Shanghai", heightCm: 166, sexForFormula: "female", activityLevel: "light" })).toMatchObject({ displayName: "New name", timezone: "Asia/Shanghai", body: { heightCm: 166, sexForFormula: "female", activityLevel: "light" } });
    expect(sqlite.prepare("SELECT password_hash FROM profile_user WHERE id = ?").get("user-1")).toEqual({ password_hash: null });
    sqlite.close();
  });

  it("creates a goal and closes the previous active goal", () => {
    const { sqlite, profile } = createService();
    const first = profile.createGoal("user-1", { goalType: "loss", calorieTargetKcal: 1800, proteinTargetG: 120, effectiveFrom: "2026-09-01", source: "manual", now: 1000 });
    const second = profile.createGoal("user-1", { goalType: "maintain", calorieTargetKcal: 2000, effectiveFrom: "2026-10-01", source: "manual", now: 2000 });
    expect(second.id).not.toBe(first.id);
    expect(profile.listGoals("user-1")).toEqual([expect.objectContaining({ id: first.id, effectiveTo: "2026-09-30" }), expect.objectContaining({ id: second.id, effectiveTo: null })]);
    sqlite.close();
  });

  it("rejects invalid profile and goal input", () => {
    const { sqlite, profile } = createService();
    expect(() => profile.updateProfile("user-1", { heightCm: 0 })).toThrow(new ProfileError("PROFILE_INVALID_INPUT"));
    expect(() => profile.createGoal("user-1", { goalType: "loss", calorieTargetKcal: 0, effectiveFrom: "2026-09-01", source: "manual" })).toThrow(new ProfileError("PROFILE_INVALID_INPUT"));
    sqlite.close();
  });
});
