import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command:
      "npm run build && npm run quality-report -- generate --config examples/minimal/quality-report.yml --input examples/minimal/quality-artifacts --output dist/example-report --zip && node scripts/serve-static.mjs dist/example-report 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
