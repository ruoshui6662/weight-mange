import { describe, expect, it } from "vitest";
import { searchStatusForResults } from "../src/search-state";

describe("food search state", () => {
  it("distinguishes matching results from an empty local catalog/query", () => {
    expect(searchStatusForResults(1)).toBe("success");
    expect(searchStatusForResults(0)).toBe("empty");
  });
});
