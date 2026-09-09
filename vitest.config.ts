import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "tools/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts", "packages/**/test/**/*.test.tsx", "tools/**/test/**/*.test.tsx", "apps/**/test/**/*.test.tsx"],
    exclude: ["**/*.integration.test.ts"],
    passWithNoTests: false,
  },
});
