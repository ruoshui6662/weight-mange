import { describe, expect, it } from "vitest";

import { projectMetadata } from "../src/index.js";

describe("projectMetadata", () => {
  it("returns the package identity and development version", () => {
    expect(projectMetadata()).toEqual({
      name: "nutrition-tracker",
      version: "0.0.0-dev",
    });
  });
});
