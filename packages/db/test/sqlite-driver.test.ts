import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { applyMigrations, openDatabase } from "../src/index.js";

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

describe("SQLite driver baseline", () => {
  it("enables the required safety pragmas", () => {
    const { sqlite } = openDatabase(":memory:");

    expect(sqlite.prepare("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
    expect(sqlite.prepare("PRAGMA busy_timeout").get()).toEqual({
      timeout: 5000,
    });
  });

  it("rolls back a transaction after a failed write", () => {
    const { sqlite } = openDatabase(":memory:");
    sqlite.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");

    expect(() => {
      sqlite.exec("BEGIN");
      sqlite.prepare("INSERT INTO sample (value) VALUES (?)").run("not committed");
      throw new Error("simulate failure");
    }).toThrow("simulate failure");
    sqlite.exec("ROLLBACK");

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sample").get()).toEqual({ count: 0 });
  });

  it("supports FTS5 for the food search gate", () => {
    const { sqlite } = openDatabase(":memory:");
    sqlite.exec("CREATE VIRTUAL TABLE food_search USING fts5(name, aliases)");
    sqlite.prepare("INSERT INTO food_search (name, aliases) VALUES (?, ?)").run("馒头", "面食 bun");

    expect(sqlite.prepare("SELECT name FROM food_search WHERE food_search MATCH ?").all("馒头")).toEqual([
      { name: "馒头" },
    ]);
  });

  it("uses WAL for a file-backed database", () => {
    const directory = mkdtempSync(join(tmpdir(), "nutrition-db-wal-"));
    temporaryPaths.push(directory);
    const databasePath = join(directory, "app.sqlite");
    const { sqlite } = openDatabase(databasePath);

    expect(sqlite.prepare("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "wal",
    });
    sqlite.close();
  });

  it("applies migrations once and rejects checksum drift", () => {
    const { sqlite } = openDatabase(":memory:");
    const migrations = [
      {
        version: "0001",
        sql: "CREATE TABLE migration_sample (id INTEGER PRIMARY KEY)",
      },
    ];

    expect(applyMigrations(sqlite, migrations, { now: () => 1000 })).toEqual({
      applied: ["0001"],
    });
    expect(applyMigrations(sqlite, migrations, { now: () => 2000 })).toEqual({
      applied: [],
    });
    expect(() =>
      applyMigrations(
        sqlite,
        [{ version: "0001", sql: "CREATE TABLE migration_sample (id INTEGER PRIMARY KEY, changed INTEGER)" }],
        { now: () => 3000 },
      ),
    ).toThrow("MIGRATION_CHECKSUM_MISMATCH");
  });

  it("rolls back a failed migration without recording it", () => {
    const { sqlite } = openDatabase(":memory:");

    expect(() =>
      applyMigrations(
        sqlite,
        [{ version: "0001", sql: "CREATE TABLE broken (id INTEGER PRIMARY KEY); SELECT * FROM missing" }],
        { now: () => 1000 },
      ),
    ).toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM core_schema_migrations").get()).toEqual({ count: 0 });
    expect(() => sqlite.prepare("SELECT * FROM broken").all()).toThrow();
  });

  it("executes a Drizzle query on the same connection", async () => {
    const { db } = openDatabase(":memory:");

    const result = await db.all(sql`SELECT 1 AS value`);

    expect(result).toEqual([{ value: 1 }]);
  });

  it("creates a consistent backup that can be reopened", async () => {
    const source = openDatabase(":memory:");
    source.sqlite.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    source.sqlite.prepare("INSERT INTO sample (value) VALUES (?)").run("backup-value");

    const directory = mkdtempSync(join(tmpdir(), "nutrition-db-"));
    temporaryPaths.push(directory);
    const target = join(directory, `${randomUUID()}.sqlite`);

    await backup(source.sqlite, target);

    expect(existsSync(target)).toBe(true);
    const restored = new DatabaseSync(target);
    expect(restored.prepare("SELECT value FROM sample").get()).toEqual({
      value: "backup-value",
    });
    restored.close();
  });
});
