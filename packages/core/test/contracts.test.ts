import { describe, expect, it } from "vitest";

import {
  AppError,
  createFixedClock,
  localDateFromEpoch,
  redactSecrets,
  resolveSetting,
  toErrorEnvelope,
  uuidv7,
} from "../src/index.js";

describe("core contracts", () => {
  it("provides a deterministic clock and user-timezone local date", () => {
    const clock = createFixedClock(0);

    expect(clock.now()).toBe(0);
    expect(localDateFromEpoch(Date.UTC(2026, 0, 1, 23, 30), "Asia/Shanghai")).toBe("2026-01-02");
  });

  it("creates a UUIDv7 with the supplied timestamp", () => {
    const id = uuidv7(1_704_067_200_000, new Uint8Array(16).fill(0));

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id.startsWith("018cc251-")) .toBe(true);
  });

  it("resolves settings in ENV, database, default order", () => {
    expect(resolveSetting("ENV", "database", "default")).toEqual({ value: "ENV", source: "env" });
    expect(resolveSetting(undefined, "database", "default")).toEqual({ value: "database", source: "database" });
    expect(resolveSetting(undefined, undefined, "default")).toEqual({ value: "default", source: "default" });
  });

  it("redacts secret-shaped values recursively", () => {
    expect(redactSecrets({ apiKey: "secret", nested: { authorization: "Bearer token" }, safe: "ok" })).toEqual({
      apiKey: "[REDACTED]",
      nested: { authorization: "[REDACTED]" },
      safe: "ok",
    });
  });

  it("serializes known application errors with a request id", () => {
    const error = new AppError("NOT_FOUND", "Food not found", { foodId: "food_1" });

    expect(toErrorEnvelope(error, "req_1")).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Food not found",
        details: { foodId: "food_1" },
        requestId: "req_1",
      },
    });
  });
});
