import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

const SQLITE_BUSY_TIMEOUT_MS = 5000;

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
