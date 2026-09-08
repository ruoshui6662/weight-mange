import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../db/src/index.js";
import { CORE_MIGRATIONS } from "../../db/src/schema.js";
import {
  AuthError,
  createSqliteAuthStore,
  createAuthService,
  sessionCookieOptions,
} from "../src/index.js";

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "nutrition-auth-"));
  temporaryPaths.push(directory);
  const { sqlite } = openDatabase(join(directory, "app.sqlite"));
  applyMigrations(sqlite, CORE_MIGRATIONS, { now: () => 1000 });
  return { sqlite, store: createSqliteAuthStore(sqlite) };
}

describe("authentication bootstrap and sessions", () => {
  it("bootstraps once and never stores the password in plaintext", () => {
    const { sqlite, store } = createStore();
    const auth = createAuthService(store, { sessionTtlMs: 60_000 });

    const user = auth.bootstrap({
      displayName: "Owner",
      password: "correct horse battery staple",
      timezone: "Asia/Shanghai",
      now: 1000,
    });

    expect(user.displayName).toBe("Owner");
    expect(auth.isInitialized()).toBe(true);
    expect(sqlite.prepare("SELECT password_hash FROM profile_user").get()).toMatchObject({
      password_hash: expect.stringContaining("scrypt$"),
    });
    expect(sqlite.prepare("SELECT password_hash FROM profile_user").get()).not.toEqual({
      password_hash: "correct horse battery staple",
    });

    expect(() =>
      auth.bootstrap({
        displayName: "Second",
        password: "another correct password",
        now: 2000,
      }),
    ).toThrow("AUTH_BOOTSTRAP_ALREADY_COMPLETED");
    sqlite.close();
  });

  it("uses the same credential error for wrong and unknown credentials, then revokes sessions", () => {
    const { sqlite, store } = createStore();
    const auth = createAuthService(store, { sessionTtlMs: 60_000 });

    expect(() => auth.login("any password", 1000)).toThrow("AUTH_INVALID_CREDENTIALS");
    auth.bootstrap({ displayName: "Owner", password: "correct horse battery staple", now: 1000 });
    expect(() => auth.login("wrong password", 1000)).toThrow("AUTH_INVALID_CREDENTIALS");

    const session = auth.login("correct horse battery staple", 1000);
    expect(session.token).not.toContain(session.userId);
    expect(auth.verifySession(session.token, 10_000).userId).toBe(session.userId);
    auth.logout(session.token, 10_000);
    expect(() => auth.verifySession(session.token, 10_001)).toThrow("AUTH_SESSION_INVALID");
    sqlite.close();
  });

  it("rejects expired sessions and exposes secure cookie defaults", () => {
    const { sqlite, store } = createStore();
    const auth = createAuthService(store, { sessionTtlMs: 100 });
    auth.bootstrap({ displayName: "Owner", password: "correct horse battery staple", now: 1000 });
    const session = auth.login("correct horse battery staple", 1000);

    expect(() => auth.verifySession(session.token, 1101)).toThrow("AUTH_SESSION_INVALID");
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(() => auth.bootstrap({ displayName: "", password: "short", now: 2000 })).toThrow(
      "AUTH_INVALID_PASSWORD",
    );
    sqlite.close();
  });
});

it("keeps auth errors machine-readable", () => {
  const error = new AuthError("AUTH_INVALID_CREDENTIALS");
  expect(error.code).toBe("AUTH_INVALID_CREDENTIALS");
  expect(error.message).toBe("AUTH_INVALID_CREDENTIALS");
});
