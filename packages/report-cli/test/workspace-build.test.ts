import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace build order", () => {
  it("builds packages sequentially from core to UI", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.build).toBe(
      "npm run build:core && npm run build:adapters && npm run build:cli && npm run build:ui"
    );
    expect(pkg.scripts["build:core"]).toContain("@quality-report/report-core");
    expect(pkg.scripts["build:adapters"]).toContain("@quality-report/adapters");
    expect(pkg.scripts["build:cli"]).toContain("@quality-report/report-cli");
    expect(pkg.scripts["build:ui"]).toContain("@quality-report/report-ui");
  });
});
