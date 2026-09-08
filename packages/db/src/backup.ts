import { createHash, randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";
import {
  copyFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname } from "node:path";

const BACKUP_FORMAT_VERSION = 1;

export type BackupManifest = {
  formatVersion: 1;
  backupFile: string;
  byteLength: number;
  sha256: string;
  createdAt: number;
};

export type CreateBackupOptions = {
  now?: () => number;
  manifestPath?: string;
};

export type RestoreBackupOptions = {
  backupPath: string;
  destinationPath: string;
  manifestPath?: string;
};

export type RestoreBackupResult = {
  manifest: BackupManifest;
  previousPath?: string;
};

function temporaryPath(path: string) {
  return `${path}.tmp-${randomUUID()}`;
}

function hashFile(path: string) {
  const contents = readFileSync(path);
  return {
    byteLength: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function fsyncFile(path: string) {
  const descriptor = openSync(path, "r+");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeAtomic(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = temporaryPath(path);
  try {
    writeFileSync(tempPath, contents, "utf8");
    fsyncFile(tempPath);
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function readManifest(path: string, backupPath: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("BACKUP_MANIFEST_INVALID");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Partial<BackupManifest>).formatVersion !== BACKUP_FORMAT_VERSION ||
    (parsed as Partial<BackupManifest>).backupFile !== basename(backupPath) ||
    typeof (parsed as Partial<BackupManifest>).byteLength !== "number" ||
    typeof (parsed as Partial<BackupManifest>).sha256 !== "string" ||
    typeof (parsed as Partial<BackupManifest>).createdAt !== "number"
  ) {
    throw new Error("BACKUP_MANIFEST_INVALID");
  }

  return parsed as BackupManifest;
}

function verifyBackup(backupPath: string, manifest: BackupManifest) {
  const actual = hashFile(backupPath);
  if (actual.byteLength !== manifest.byteLength || actual.sha256 !== manifest.sha256) {
    throw new Error("BACKUP_CHECKSUM_MISMATCH");
  }

  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(backupPath, { readOnly: true });
    const result = database.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
    if (result.integrity_check !== "ok") {
      throw new Error("BACKUP_INTEGRITY_CHECK_FAILED");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "BACKUP_INTEGRITY_CHECK_FAILED") {
      throw error;
    }
    throw new Error("BACKUP_INTEGRITY_CHECK_FAILED", { cause: error });
  } finally {
    database?.close();
  }
}

export async function createBackup(
  source: DatabaseSync,
  backupPath: string,
  options: CreateBackupOptions = {},
): Promise<BackupManifest> {
  mkdirSync(dirname(backupPath), { recursive: true });
  const tempBackupPath = temporaryPath(backupPath);
  const manifestPath = options.manifestPath ?? `${backupPath}.manifest.json`;
  try {
    await backup(source, tempBackupPath);
    const { byteLength, sha256 } = hashFile(tempBackupPath);
    const manifest: BackupManifest = {
      formatVersion: BACKUP_FORMAT_VERSION,
      backupFile: basename(backupPath),
      byteLength,
      sha256,
      createdAt: (options.now ?? Date.now)(),
    };
    writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(tempBackupPath, backupPath);
    return manifest;
  } catch (error) {
    rmSync(tempBackupPath, { force: true });
    throw error;
  }
}

export function restoreBackup(options: RestoreBackupOptions): RestoreBackupResult {
  const manifestPath = options.manifestPath ?? `${options.backupPath}.manifest.json`;
  const manifest = readManifest(manifestPath, options.backupPath);
  verifyBackup(options.backupPath, manifest);

  mkdirSync(dirname(options.destinationPath), { recursive: true });
  const tempDestinationPath = temporaryPath(options.destinationPath);
  const previousPath = existsSync(options.destinationPath)
    ? `${options.destinationPath}.pre-restore-${randomUUID()}`
    : undefined;

  try {
    copyFileSync(options.backupPath, tempDestinationPath);
    fsyncFile(tempDestinationPath);
    if (previousPath !== undefined) {
      renameSync(options.destinationPath, previousPath);
    }
    renameSync(tempDestinationPath, options.destinationPath);
    return { manifest, ...(previousPath === undefined ? {} : { previousPath }) };
  } catch (error) {
    rmSync(tempDestinationPath, { force: true });
    if (previousPath !== undefined && !existsSync(options.destinationPath) && existsSync(previousPath)) {
      renameSync(previousPath, options.destinationPath);
    }
    throw error;
  }
}
