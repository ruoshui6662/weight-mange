import { randomBytes } from "node:crypto";

export type Clock = {
  now(): number;
};

export function createSystemClock(): Clock {
  return { now: () => Date.now() };
}

export function createFixedClock(timestampMs: number): Clock {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new RangeError("timestampMs must be a non-negative safe integer");
  }
  return { now: () => timestampMs };
}

export function localDateFromEpoch(timestampMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(new Date(timestampMs)).map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function uuidv7(timestampMs = Date.now(), random = randomBytes(16)): string {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs >= 2 ** 48) {
    throw new RangeError("timestampMs must fit in the UUIDv7 48-bit timestamp");
  }
  if (random.length !== 16) {
    throw new RangeError("random must contain exactly 16 bytes");
  }

  const bytes = new Uint8Array(random);
  let timestamp = BigInt(timestampMs);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type SettingSource = "env" | "database" | "default";

export function resolveSetting(
  envValue: string | undefined,
  databaseValue: string | undefined,
  defaultValue: string,
): { value: string; source: SettingSource } {
  if (envValue !== undefined && envValue !== "") {
    return { value: envValue, source: "env" };
  }
  if (databaseValue !== undefined && databaseValue !== "") {
    return { value: databaseValue, source: "database" };
  }
  return { value: defaultValue, source: "default" };
}

const SECRET_KEY = /(api[-_]?key|authorization|password|secret|token|cookie)/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : redactSecrets(item)]),
  );
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATASET_IMPORT_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_API_ERROR"
  | "AI_PROVIDER_ERROR"
  | "AI_RESPONSE_INVALID"
  | "BACKUP_ERROR"
  | "MIGRATION_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function toErrorEnvelope(error: unknown, requestId: string): {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown>; requestId: string };
} {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId,
      },
    };
  }

  return {
    error: {
      code: "DATABASE_ERROR",
      message: "Internal server error",
      requestId,
    },
  };
}
