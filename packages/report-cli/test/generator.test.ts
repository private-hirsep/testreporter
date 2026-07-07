import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { buildReport } from "../src/generator.js";

describe("report generator", () => {
  it("generates normalized report data from the minimal example", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "quality-report-"));
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath);
    const report = await buildReport({
      config,
      configPath,
      inputPath: path.join(root, "examples/minimal/quality-artifacts"),
      outputPath: output,
      zip: true
    });
    expect(report.tests.length).toBeGreaterThan(0);
    expect(report.summary.tests.byLayer.backend).toBeGreaterThan(0);
    expect(report.downloads.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(root.replace(/\\/g, "\\\\"));
    expect(report.downloads.every((download) => !download.sourcePath || !path.isAbsolute(download.sourcePath))).toBe(
      true
    );
    expect(report.downloads.some((download) => download.category === "report" && download.path.endsWith(".zip"))).toBe(
      true
    );
    expect(report.warnings.some((warning) => warning.code === "artifact.parse-failed")).toBe(true);
    expect(report.requirements.testsByRequirement["RFL-101"]?.length).toBeGreaterThan(0);
    expect(report.security.some((finding) => finding.helpUri || finding.evidence)).toBe(true);
  });
});
