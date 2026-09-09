import { describe, expect, it } from "vitest";

import { bootstrapError, validateBootstrapInput } from "../src/bootstrap-validation";

describe("bootstrap validation", () => {
  it("rejects a password shorter than the server minimum before sending a request", () => {
    expect(validateBootstrapInput({ displayName: "ruoshui", password: "12345678901" })).toEqual("AUTH_INVALID_PASSWORD");
  });

  it("accepts a trimmed display name and a twelve-character password", () => {
    expect(validateBootstrapInput({ displayName: "  ruoshui  ", password: "123456789012" })).toBeNull();
  });

  it("turns the password error into an actionable Chinese message", () => {
    expect(bootstrapError("AUTH_INVALID_PASSWORD")).toBe("密码至少需要 12 个字符。");
  });
});
