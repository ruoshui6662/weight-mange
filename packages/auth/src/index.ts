import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const PASSWORD_MIN_LENGTH = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;

export type AuthErrorCode =
  | "AUTH_INVALID_PASSWORD"
  | "AUTH_BOOTSTRAP_ALREADY_COMPLETED"
  | "AUTH_NOT_INITIALIZED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_SESSION_INVALID";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "AuthError";
    this.code = code;
  }
}

export type AuthUser = {
  id: string;
  displayName: string;
  timezone: string;
};

type StoredUser = AuthUser & { passwordHash: string };

type StoredSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  revokedAt: number | null;
};

export type AuthStore = {
  isInitialized(): boolean;
  bootstrapUser(input: {
    id: string;
    displayName: string;
    timezone: string;
    passwordHash: string;
    createdAt: number;
  }): void;
  findPasswordUser(): StoredUser | undefined;
  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: number;
    createdAt: number;
  }): void;
  findSession(tokenHash: string): StoredSession | undefined;
  touchSession(tokenHash: string, lastSeenAt: number): void;
  revokeSession(tokenHash: string, revokedAt: number): void;
};

function encodeBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    encodeBase64Url(salt),
    encodeBase64Url(hash),
  ].join("$");
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, n, r, p, encodedSalt, encodedExpected] = encodedHash.split("$");
  if (algorithm !== "scrypt" || n === undefined || r === undefined || p === undefined) {
    return false;
  }
  try {
    const expected = decodeBase64Url(encodedExpected ?? "");
    const actual = scryptSync(password, decodeBase64Url(encodedSalt ?? ""), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAX_MEMORY,
    });
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const DUMMY_PASSWORD_HASH = hashPassword("nutrition-tracker-dummy-password");

export function createSqliteAuthStore(sqlite: DatabaseSync): AuthStore {
  return {
    isInitialized() {
      const row = sqlite
        .prepare(
          "SELECT 1 AS initialized FROM core_settings WHERE key = 'system.initialized' LIMIT 1",
        )
        .get() as { initialized?: number } | undefined;
      return row?.initialized === 1;
    },

    bootstrapUser(input) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sqlite
          .prepare(
            "INSERT INTO core_settings (key, value_json, encrypted, updated_at) VALUES (?, ?, 0, ?)",
          )
          .run("system.initialized", JSON.stringify({ userId: input.id }), input.createdAt);
        sqlite
          .prepare(
            "INSERT INTO profile_user (id, display_name, password_hash, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            input.id,
            input.displayName,
            input.passwordHash,
            input.timezone,
            input.createdAt,
            input.createdAt,
          );
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        if (error instanceof Error && error.message.includes("core_settings")) {
          throw new AuthError("AUTH_BOOTSTRAP_ALREADY_COMPLETED", { cause: error });
        }
        throw error;
      }
    },

    findPasswordUser() {
      const row = sqlite
        .prepare(
          "SELECT id, display_name, timezone, password_hash FROM profile_user WHERE password_hash IS NOT NULL ORDER BY created_at LIMIT 1",
        )
        .get() as
        | { id: string; display_name: string; timezone: string; password_hash: string }
        | undefined;
      return row === undefined
        ? undefined
        : {
            id: row.id,
            displayName: row.display_name,
            timezone: row.timezone,
            passwordHash: row.password_hash,
          };
    },

    createSession(input) {
      sqlite
        .prepare(
          "INSERT INTO core_session (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(input.id, input.userId, input.tokenHash, input.expiresAt, input.createdAt, input.createdAt);
    },

    findSession(tokenHash) {
      const row = sqlite
        .prepare(
          "SELECT id, user_id, token_hash, expires_at, revoked_at FROM core_session WHERE token_hash = ? LIMIT 1",
        )
        .get(tokenHash) as
        | { id: string; user_id: string; token_hash: string; expires_at: number; revoked_at: number | null }
        | undefined;
      return row === undefined
        ? undefined
        : {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
          };
    },

    touchSession(tokenHash, lastSeenAt) {
      sqlite.prepare("UPDATE core_session SET last_seen_at = ? WHERE token_hash = ?").run(lastSeenAt, tokenHash);
    },

    revokeSession(tokenHash, revokedAt) {
      sqlite
        .prepare("UPDATE core_session SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?")
        .run(revokedAt, tokenHash);
    },
  };
}

export type AuthServiceOptions = {
  sessionTtlMs?: number;
  now?: () => number;
};

export function createAuthService(store: AuthStore, options: AuthServiceOptions = {}) {
  const sessionTtlMs = options.sessionTtlMs ?? SESSION_TTL_MS;
  const now = options.now ?? Date.now;

  return {
    isInitialized() {
      return store.isInitialized();
    },

    bootstrap(input: { displayName: string; password: string; timezone?: string; now?: number }): AuthUser {
      const displayName = input.displayName.trim();
      if (displayName.length === 0 || input.password.length < PASSWORD_MIN_LENGTH) {
        throw new AuthError("AUTH_INVALID_PASSWORD");
      }
      const createdAt = input.now ?? now();
      const user = {
        id: randomUUID(),
        displayName,
        timezone: input.timezone ?? "UTC",
        passwordHash: hashPassword(input.password),
        createdAt,
      };
      store.bootstrapUser(user);
      return { id: user.id, displayName: user.displayName, timezone: user.timezone };
    },

    login(password: string, timestamp = now()) {
      const user = store.findPasswordUser();
      const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (user === undefined || !valid) {
        throw new AuthError("AUTH_INVALID_CREDENTIALS");
      }
      const token = randomBytes(32).toString("base64url");
      store.createSession({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: timestamp + sessionTtlMs,
        createdAt: timestamp,
      });
      return { token, userId: user.id, expiresAt: timestamp + sessionTtlMs };
    },

    verifySession(token: string, timestamp = now()) {
      const session = store.findSession(hashToken(token));
      if (session === undefined || session.revokedAt !== null || session.expiresAt <= timestamp) {
        throw new AuthError("AUTH_SESSION_INVALID");
      }
      store.touchSession(session.tokenHash, timestamp);
      return { userId: session.userId, expiresAt: session.expiresAt };
    },

    logout(token: string, timestamp = now()) {
      store.revokeSession(hashToken(token), timestamp);
    },
  };
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}
