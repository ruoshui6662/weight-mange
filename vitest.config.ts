import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
    passWithNoTests: false,
  },
});
