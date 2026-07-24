import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@quality-report/report-core/history-schema",
        replacement: path.resolve(
          __dirname,
          "packages/report-core/src/history/artifact-schema.ts"
        )
      },
      {
        find: /^@quality-report\/report-core$/,
        replacement: path.resolve(__dirname, "packages/report-core/src/index.ts")
      },
      {
        find: /^@quality-report\/adapters$/,
        replacement: path.resolve(__dirname, "packages/adapters/src/index.ts")
      }
    ]
  },
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "lcov"]
    }
  }
});
