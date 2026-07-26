import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const packagePaths = [
  "packages/report-core/package.json",
  "packages/adapters/package.json",
  "packages/report-cli/package.json"
];

describe("release package contracts", () => {
  it("uses versioned runtime dependencies and explicit package allowlists", async () => {
    for (const relative of packagePaths) {
      const manifest = JSON.parse(
        await readFile(path.join(root, relative), "utf8")
      ) as {
        version: string;
        files?: string[];
        dependencies?: Record<string, string>;
      };
      expect(manifest.version).toBe("1.0.0-rc.1");
      expect(manifest.files).toEqual(["dist", "README.md", "LICENSE"]);
      expect(Object.values(manifest.dependencies ?? {})).not.toContainEqual(
        expect.stringMatching(/^file:\.\.\//)
      );
    }
  });

  it("runs the clean-install smoke test from the release workflow", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/release.yml"),
      "utf8"
    );
    expect(workflow).toContain("npm run release:smoke");
    expect(workflow).toContain("dist/release/*.tgz");
  });
});
