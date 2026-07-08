import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const paths = [
  "dist",
  ".quality-report-summary",
  "test-results",
  "playwright-report",
  "coverage",
  "packages/report-core/dist",
  "packages/adapters/dist",
  "packages/report-cli/dist",
  "packages/report-ui/dist",
  "packages/report-ui/dist-ts"
];

for (const target of paths) {
  rmSync(target, { recursive: true, force: true });
}

function removeBuildInfo(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const target = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      removeBuildInfo(target);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
      rmSync(target, { force: true });
    }
  }
}

removeBuildInfo(".");
