import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createBackup, restoreBackup } from "../src/backup.js";

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

function createDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "nutrition-backup-"));
  temporaryPaths.push(directory);
  return directory;
}

describe("SQLite backup and restore", () => {
  it("writes a checksummed manifest and restores a consistent backup", async () => {
    const directory = createDirectory();
    const source = new DatabaseSync(":memory:");
    source.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    source.prepare("INSERT INTO sample (value) VALUES (?)").run("before-backup");
    const backupPath = join(directory, "backup.sqlite");
    const destinationPath = join(directory, "restored.sqlite");

    const manifest = await createBackup(source, backupPath, { now: () => 1234 });

    expect(manifest).toMatchObject({
      formatVersion: 1,
      backupFile: "backup.sqlite",
      createdAt: 1234,
    });
    expect(manifest.sha256).toBe(
      createHash("sha256").update(readFileSync(backupPath)).digest("hex"),
    );
    expect(existsSync(`${backupPath}.manifest.json`)).toBe(true);

    const result = restoreBackup({ backupPath, destinationPath });
    expect(result.previousPath).toBeUndefined();
    const restored = new DatabaseSync(destinationPath);
    expect(restored.prepare("SELECT value FROM sample").get()).toEqual({ value: "before-backup" });
    restored.close();
    source.close();
  });

  it("rejects a corrupted backup without replacing the existing database", async () => {
    const directory = createDirectory();
    const source = new DatabaseSync(":memory:");
    source.exec("CREATE TABLE sample (value TEXT NOT NULL)");
    source.prepare("INSERT INTO sample (value) VALUES (?)").run("valid");
    const backupPath = join(directory, "backup.sqlite");
    const destinationPath = join(directory, "restored.sqlite");
    await createBackup(source, backupPath);

    const existing = new DatabaseSync(destinationPath);
    existing.exec("CREATE TABLE sample (value TEXT NOT NULL)");
    existing.prepare("INSERT INTO sample (value) VALUES (?)").run("keep-me");
    existing.close();
    writeFileSync(backupPath, Buffer.concat([readFileSync(backupPath), Buffer.from("corrupt")]))

    expect(() => restoreBackup({ backupPath, destinationPath })).toThrow("BACKUP_CHECKSUM_MISMATCH");

    const unchanged = new DatabaseSync(destinationPath);
    expect(unchanged.prepare("SELECT value FROM sample").get()).toEqual({ value: "keep-me" });
    unchanged.close();
    source.close();
  });
});
