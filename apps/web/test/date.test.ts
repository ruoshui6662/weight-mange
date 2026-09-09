import { describe, expect, it } from "vitest";
import { localDateNow } from "../src/date";

describe("web local date", () => {
  it("derives today from the user's timezone instead of UTC", () => {
    const instant = new Date("2026-09-09T16:30:00.000Z");
    expect(localDateNow("UTC", instant)).toBe("2026-09-09");
    expect(localDateNow("Asia/Shanghai", instant)).toBe("2026-09-10");
  });
});
