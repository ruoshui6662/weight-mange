import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

const SQLITE_BUSY_TIMEOUT_MS = 5000;

export type SqliteMigration = {
  version: string;
  sql: string;
};

export type ApplyMigrationsOptions = {
  now?: () => number;
};

export function openDatabase(path: string) {
  const sqlite = new DatabaseSync(path, {
    timeout: SQLITE_BUSY_TIMEOUT_MS,
  });

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};
    PRAGMA temp_store = MEMORY;
  `);

  const db = drizzle({ client: sqlite });

  return { db, sqlite };
}

export function applyMigrations(
  sqlite: DatabaseSync,
  migrations: readonly SqliteMigration[],
  options: ApplyMigrationsOptions = {},
): { applied: string[] } {
  const now = options.now ?? Date.now;
  const seenVersions = new Set<string>();

  for (const migration of migrations) {
    if (seenVersions.has(migration.version)) {
      throw new Error(`DUPLICATE_MIGRATION_VERSION:${migration.version}`);
    }
    seenVersions.add(migration.version);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS core_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      duration_ms INTEGER NOT NULL
    )
  `);

  const appliedRows = sqlite
    .prepare("SELECT version, checksum FROM core_schema_migrations")
    .all() as Array<{ version: string; checksum: string }>;
  const appliedByVersion = new Map(appliedRows.map((row) => [row.version, row.checksum]));
  const applied: string[] = [];

  for (const migration of migrations) {
    const checksum = createHash("sha256").update(migration.sql).digest("hex");
    const previousChecksum = appliedByVersion.get(migration.version);

    if (previousChecksum !== undefined) {
      if (previousChecksum !== checksum) {
        throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${migration.version}`);
      }
      continue;
    }

    const startedAt = now();
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.exec(migration.sql);
      sqlite
        .prepare(
          "INSERT INTO core_schema_migrations (version, applied_at, checksum, duration_ms) VALUES (?, ?, ?, ?)",
        )
        .run(migration.version, now(), checksum, Math.max(0, now() - startedAt));
      sqlite.exec("COMMIT");
      applied.push(migration.version);
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  return { applied };
}

export * from "./backup.js";
