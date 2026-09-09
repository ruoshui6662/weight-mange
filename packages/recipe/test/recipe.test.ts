import { describe, expect, it } from "vitest";

import { RECIPE_CALC_VERSION } from "../src/index.js";

describe("recipe package baseline", () => {
  it("exports the fixed recipe calculation version", () => {
    expect(RECIPE_CALC_VERSION).toBe("recipe_yield_v1");
  });
});
