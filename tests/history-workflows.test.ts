import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const examples = [
  "trusted-main-history.yml",
  "read-only-pr-history.yml",
  "release-history.yml",
  "central-portfolio-history.yml"
].map((name) => path.resolve("examples/github-actions", name));

describe("history workflow examples", () => {
  it("parses every example and resolves every referenced local workflow", async () => {
    for (const file of examples) {
      await expect(stat(file)).resolves.toBeTruthy();
      const source = await readFile(file, "utf8");
      expect(parse(source)).toBeTruthy();
      for (const match of source.matchAll(/uses:\s+(\.\/\.github\/workflows\/\S+)/g))
        await expect(stat(path.resolve(match[1]!))).resolves.toBeTruthy();
    }
  });

  it("merges history before uploading the final trusted report", async () => {
    const source = await readFile(examples[0]!, "utf8");
    expect(source.indexOf("--static-output site/data/history.json")).toBeGreaterThan(0);
    expect(source.indexOf("actions/upload-pages-artifact")).toBeGreaterThan(
      source.indexOf("--static-output site/data/history.json")
    );
    expect(source).toContain("mkdir -p history-checkout");
    expect(source).toContain("git init");
    expect(source).toContain("for attempt in 1 2 3");
    expect(source).toContain("history merge");
    expect(source).not.toContain("force");
  });

  it("keeps pull requests read-only and isolates trusted write permission", async () => {
    const pullRequest = await readFile(examples[1]!, "utf8");
    expect(pullRequest).toContain("permissions: { contents: read }");
    expect(pullRequest).not.toContain("contents: write");
    const trusted = await readFile(examples[0]!, "utf8");
    expect(trusted).toContain("merge-publish-persist:");
    expect(trusted).toContain("contents: write");
    expect(trusted).toContain("persist-credentials: false");
  });
});
