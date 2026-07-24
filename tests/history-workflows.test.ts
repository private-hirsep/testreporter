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
    expect(source.indexOf("persist-history.sh")).toBeGreaterThan(0);
    expect(source.indexOf("actions/upload-pages-artifact")).toBeGreaterThan(
      source.indexOf("persist-history.sh")
    );
    expect(source).toContain("actions/deploy-pages@v4");
    expect(source).toContain("needs: persist");
    const persistence = await readFile(path.resolve("scripts/persist-history.sh"), "utf8");
    expect(persistence).toContain("remote add origin");
    expect(persistence).toContain("for attempt in");
    expect(persistence).toContain("history merge");
    expect(persistence).toContain("refetching and remerging");
    expect(persistence).not.toMatch(/push[^\n]*--force|push[^\n]*-f(?:\s|$)/);
  });

  it("keeps pull requests read-only and isolates trusted write permission", async () => {
    const pullRequest = await readFile(examples[1]!, "utf8");
    expect(pullRequest).toContain("permissions: { contents: read }");
    expect(pullRequest).not.toContain("contents: write");
    const trusted = await readFile(examples[0]!, "utf8");
    expect(trusted).toContain("persist:");
    expect(trusted).toContain("contents: write");
    expect(trusted).toContain("persist-credentials: false");
  });

  it("uses shared persistence for release and a real portfolio summary branch", async () => {
    const trusted = await readFile(examples[0]!, "utf8");
    const release = await readFile(examples[2]!, "utf8");
    for (const source of [trusted, release]) {
      expect(source).toContain("scripts/persist-history.sh");
      expect(source).toContain("actions/upload-pages-artifact@v3");
      expect(source).toContain("actions/deploy-pages@v4");
    }
    const portfolio = await readFile(examples[3]!, "utf8");
    expect(portfolio).toContain("QUALITY_SUMMARY_REPOSITORY");
    expect(portfolio).toContain("ref: quality-summaries");
    expect(portfolio).not.toContain("actions/download-artifact");
    expect(portfolio).toContain("actions/deploy-pages@v4");
  });
});
