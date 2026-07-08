import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@quality-report/report-core": path.resolve(__dirname, "packages/report-core/src/index.ts"),
      "@quality-report/adapters": path.resolve(__dirname, "packages/adapters/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "lcov"]
    }
  }
});
