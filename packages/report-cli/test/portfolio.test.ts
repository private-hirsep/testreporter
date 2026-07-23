import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPortfolio } from "../src/portfolio.js";

describe("portfolio generator", () => {
  it("keeps downloaded project artifacts in separate directories", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const workflow = await readFile(
      path.join(root, ".github/workflows/portfolio-example.yml"),
      "utf8"
    );
    expect(workflow).toContain("merge-multiple: false");
    expect(workflow).not.toContain("merge-multiple: true");
  });

  it("validates, sorts and renders three local summaries", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "qr-portfolio-"));
    const items = await buildPortfolio(
      path.join(root, "examples/portfolio"),
      output,
      7,
      new Date("2026-07-15T12:00:00Z")
    );
    expect(items.map((item) => item.projectKey)).toEqual(["ALPHA", "GAMMA", "BETA"]);
    expect(items.find((item) => item.projectKey === "GAMMA")?.stale).toBe(true);
    const html = await readFile(path.join(output, "index.html"), "utf8");
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect(html).toContain("Gamma");
    expect(html).toContain('data-priority="1"');
    expect(html).toContain("Blocked");
    expect(html).toContain("Stale report");
    expect(html).toContain("Manual remaining");
    expect(html).toContain('<a href="https://example.invalid/alpha/">Alpha</a>');
    expect(html).toContain("Project quality portfolio");
  });

  it("renders an honest empty state without project summaries", async () => {
    const input = await mkdtemp(path.join(os.tmpdir(), "qr-portfolio-empty-"));
    const output = path.join(input, "output");
    const projects = await buildPortfolio(input, output);
    expect(projects).toHaveLength(0);
    const html = await readFile(path.join(output, "index.html"), "utf8");
    expect(html).toContain("No project summaries were found");
  });

  it("rejects duplicate project keys with source paths", async () => {
    const input = await mkdtemp(path.join(os.tmpdir(), "qr-portfolio-duplicates-"));
    const output = path.join(input, "output");
    const summary = {
      schemaVersion: "1.0",
      projectKey: "DUPLICATE",
      projectName: "Duplicate",
      generatedAt: "2026-07-15T12:00:00.000Z",
      qualityGate: "passed",
      readiness: "ready",
      passedTests: 1,
      failedTests: 0,
      newFailures: 0,
      manualRemaining: 0,
      uncoveredRequirements: 0,
      securityBlockers: 0,
      acceptedRisks: 0,
      recommendedActions: 0
    };
    for (const directory of ["first", "second"]) {
      await mkdir(path.join(input, directory));
      await writeFile(
        path.join(input, directory, "project-quality-summary.json"),
        JSON.stringify(summary)
      );
    }
    await expect(buildPortfolio(input, output)).rejects.toThrow(
      /Duplicate project summary key\(s\): DUPLICATE \(first\/project-quality-summary.json, second\/project-quality-summary.json\)/
    );
  });
});
