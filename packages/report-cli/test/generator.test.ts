import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QualityReportConfigSchema } from "@quality-report/report-core";
import { loadConfig } from "../src/config.js";
import { buildReport } from "../src/generator.js";

async function assertFullHtml(output: string) {
  const html = await readFile(path.join(output, "index.html"), "utf8");
  expect(html).toContain("<!doctype html>");
  expect(html).toContain("<html");
  expect(html).toContain("<head>");
  expect(html).toContain('charset="UTF-8"');
  expect(html).toContain('name="viewport"');
  expect(html).toContain("<title>Quality Report</title>");
  expect(html).toContain("<body>");
  await expect(stat(path.join(output, "404.html"))).resolves.toBeTruthy();
  return html;
}

async function assertManifestReferencesExist(output: string) {
  const manifest = JSON.parse(await readFile(path.join(output, "data/manifest.json"), "utf8")) as {
    chunks: { tests: string[] };
    downloads: Array<{ path: string }>;
  };
  for (const chunk of manifest.chunks.tests) {
    await expect(stat(path.join(output, "data", chunk))).resolves.toBeTruthy();
  }
  for (const download of manifest.downloads) {
    await expect(stat(path.join(output, download.path))).resolves.toBeTruthy();
  }
}

async function readGeneratedTextFiles(root: string): Promise<string> {
  const parts: string[] = [];
  const visit = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
        continue;
      }
      if (/\.(json|html)$/i.test(entry.name)) parts.push(await readFile(full, "utf8"));
    }
  };
  await visit(root);
  return parts.join("\n");
}

function zipEntries(buffer: Buffer) {
  const names: string[] = [];
  for (let offset = 0; offset < buffer.length - 4; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    names.push(buffer.subarray(nameStart, nameStart + nameLength).toString("utf8"));
    offset = nameStart + nameLength + extraLength + commentLength - 1;
  }
  return names;
}

describe("report generator", () => {
  it("generates normalized report data from the minimal example", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "quality-report-"));
    await mkdir(path.join(output, "assets"), { recursive: true });
    await writeFile(path.join(output, "assets", "stale.js"), "old");
    await writeFile(path.join(output, "quality-report-stale.zip"), "old");
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath);
    const report = await buildReport({
      config,
      configPath,
      inputPath: path.join(root, "examples/minimal/quality-artifacts"),
      outputPath: output,
      zip: true,
      publishMode: "artifact",
      prCommentMode: "minimal",
      prCommentMarker: "<!-- quality-report-platform:summary -->"
    });
    expect(report.tests.length).toBeGreaterThan(0);
    expect(report.summary.tests.byLayer.backend).toBeGreaterThan(0);
    expect(report.downloads.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(root.replace(/\\/g, "\\\\"));
    expect(
      report.downloads.every(
        (download) => !download.sourcePath || !path.isAbsolute(download.sourcePath)
      )
    ).toBe(true);
    expect(
      report.downloads.some(
        (download) => download.category === "report" && download.path.endsWith(".zip")
      )
    ).toBe(true);
    expect(report.warnings.some((warning) => warning.code === "sarif.malformed")).toBe(true);
    expect(report.requirements.testsByRequirement["JIRA-101"]?.length).toBeGreaterThan(0);
    expect(report.security.some((finding) => finding.helpUri || finding.evidence)).toBe(true);
    await assertFullHtml(output);
    await assertManifestReferencesExist(output);
    await expect(stat(path.join(output, "assets", "stale.js"))).rejects.toThrow();
    const reportZips = (await readdir(output)).filter((file) =>
      /^quality-report.*\.zip$/i.test(file)
    );
    expect(reportZips).toHaveLength(1);
    const manifest = JSON.parse(
      await readFile(path.join(output, "data/manifest.json"), "utf8")
    ) as {
      metadata: { publishMode?: string; prCommentMode?: string };
    };
    const summary = JSON.parse(
      await readFile(path.join(output, "meta/quality-summary.json"), "utf8")
    ) as {
      publishMode?: string;
      prCommentMode?: string;
    };
    const minimalComment = await readFile(path.join(output, "meta/pr-comment-minimal.md"), "utf8");
    const fullComment = await readFile(path.join(output, "meta/pr-comment-full.md"), "utf8");
    expect(manifest.metadata.publishMode).toBe("artifact");
    expect(manifest.metadata.prCommentMode).toBe("minimal");
    expect(summary.publishMode).toBe("artifact");
    expect(summary.prCommentMode).toBe("minimal");
    expect(minimalComment.startsWith("<!-- quality-report-platform:summary -->")).toBe(true);
    expect(fullComment.startsWith("<!-- quality-report-platform:summary -->")).toBe(true);
  });

  it("generates passing and failing reports with the same UI bundle and downloadable ZIPs", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const inputPath = path.join(root, "examples/minimal/quality-artifacts");
    const passingOutput = await mkdtemp(path.join(os.tmpdir(), "quality-report-pass-"));
    const failingOutput = await mkdtemp(path.join(os.tmpdir(), "quality-report-fail-"));
    const passingConfigPath = path.join(root, "examples/minimal/quality-report.yml");
    const failingConfigPath = path.join(root, "examples/failing/quality-report.yml");
    const passingReport = await buildReport({
      config: await loadConfig(passingConfigPath),
      configPath: passingConfigPath,
      inputPath,
      outputPath: passingOutput,
      zip: true
    });
    const failingReport = await buildReport({
      config: await loadConfig(failingConfigPath),
      configPath: failingConfigPath,
      inputPath,
      outputPath: failingOutput,
      zip: true
    });

    expect(passingReport.qualityGate.status).toBe("passed");
    expect(failingReport.qualityGate.status).toBe("failed");
    expect(failingReport.downloads.some((download) => download.category === "report")).toBe(true);
    expect(await assertFullHtml(passingOutput)).toBe(await assertFullHtml(failingOutput));
    await assertManifestReferencesExist(passingOutput);
    await assertManifestReferencesExist(failingOutput);
  });

  it("keeps generated static output deterministic and free of local path leaks", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "quality-report-"));
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath);
    await writeFile(path.join(output, "quality-report-stale.zip"), "stale");
    const report = await buildReport({
      config,
      configPath,
      inputPath: path.join(root, "examples/minimal/quality-artifacts"),
      outputPath: output,
      zip: true
    });
    const entries = await readdir(output);
    const zipFiles = entries.filter((entry) => /^quality-report.*\.zip$/i.test(entry));
    const manifest = await readFile(path.join(output, "data/manifest.json"), "utf8");
    const tests = await readFile(path.join(output, "data/tests-0.json"), "utf8");
    const combined = `${manifest}\n${tests}`;
    expect(zipFiles).toHaveLength(1);
    expect(zipFiles[0]).not.toBe("quality-report-stale.zip");
    expect(combined).not.toMatch(/[A-Za-z]:[\\/](?![\\/])/);
    expect(combined).not.toContain("file://");
    expect(combined).not.toContain("/home/");
    expect(report.downloads.some((download) => download.category === "report")).toBe(true);

    const zipBuffer = await readFile(path.join(output, zipFiles[0]!));
    const entriesInZip = zipEntries(zipBuffer);
    expect(
      entriesInZip.some((entry) => /^quality-report.*\.zip$/i.test(path.basename(entry)))
    ).toBe(false);
    expect(entriesInZip).toContain("index.html");
    expect(entriesInZip).toContain("404.html");
  });

  it("generates complete output with missing optional sections and chunks large suites", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-large-"));
    const input = path.join(temp, "quality-artifacts");
    const output = path.join(temp, "report");
    await mkdir(path.join(input, "tests", "backend", "junit"), { recursive: true });
    const cases = Array.from(
      { length: 505 },
      (_, index) => `<testcase classname="Large" name="test JIRA-${index + 1}" time="0.001" />`
    ).join("");
    await writeFile(
      path.join(input, "tests", "backend", "junit", "large.xml"),
      `<testsuite>${cases}</testsuite>`
    );
    const config = loadConfigFromObject({
      project: { name: "Large" },
      artifacts: { tests: { backend: { junit: "tests/backend/junit/**/*.xml" } } },
      requirements: { keyPattern: "JIRA-[0-9]+" }
    });

    const report = await buildReport({
      config,
      configPath: "quality-report.yml",
      inputPath: input,
      outputPath: output
    });

    expect(report.tests).toHaveLength(505);
    expect(report.coverage).toEqual([]);
    expect(report.security).toEqual([]);
    await assertFullHtml(output);
    const manifest = JSON.parse(
      await readFile(path.join(output, "data/manifest.json"), "utf8")
    ) as {
      chunks: { tests: string[] };
    };
    expect(manifest.chunks.tests).toEqual(["tests-0.json", "tests-1.json"]);
    await assertManifestReferencesExist(output);
  });

  it("continues through malformed optional artifacts and does not leak absolute parser paths", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-warnings-"));
    const input = path.join(temp, "quality-artifacts");
    const output = path.join(temp, "report");
    await mkdir(path.join(input, "tests", "backend", "junit"), { recursive: true });
    await mkdir(path.join(input, "coverage", "frontend"), { recursive: true });
    await mkdir(path.join(input, "requirements"), { recursive: true });
    await mkdir(path.join(input, "security", "codeql"), { recursive: true });
    await mkdir(path.join(input, "raw"), { recursive: true });
    await writeFile(
      path.join(input, "tests", "backend", "junit", "tests.xml"),
      '<testsuite><testcase classname="A" name="uses JIRA-1" file="/home/runner/work/repo/src/a.test.ts" /></testsuite>'
    );
    await writeFile(path.join(input, "coverage", "frontend", "coverage-summary.json"), "{");
    await writeFile(path.join(input, "requirements", "expected.csv"), "key\nJIRA-1\nJIRA-2\nJIRA-2\n");
    await writeFile(path.join(input, "requirements", "mapping.json"), "{");
    await writeFile(path.join(input, "security", "codeql", "bad.sarif"), "{");
    await writeFile(path.join(input, "raw", "evidence.txt"), "raw");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "old.txt"), "stale");
    const config = loadConfigFromObject({
      project: { name: "Warnings" },
      artifacts: {
        tests: { backend: { junit: "tests/backend/junit/**/*.xml" } },
        coverage: { frontend: { summaryJson: "coverage/frontend/coverage-summary.json" } },
        requirements: {
          expectedKeys: "requirements/expected.csv",
          mapping: "requirements/mapping.json"
        },
        security: { codeqlSarif: "security/codeql/**/*.sarif" },
        raw: "raw/**/*"
      },
      requirements: { keyPattern: "JIRA-[0-9]+" },
      qualityGates: { requirements: { failOnMissing: true } }
    });

    const report = await buildReport({
      config,
      configPath: "quality-report.yml",
      inputPath: input,
      outputPath: output,
      zip: true
    });

    expect(report.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "coverage.istanbul.malformed",
        "requirements.mapping.parse-failed",
        "sarif.malformed"
      ])
    );
    expect(report.qualityGate.status).toBe("failed");
    expect(report.requirements.missing).toEqual(["JIRA-2"]);
    expect(report.downloads.some((download) => download.name === "evidence.txt")).toBe(true);
    await expect(stat(path.join(output, "old.txt"))).rejects.toThrow();
    await assertManifestReferencesExist(output);
    const generatedText = await readGeneratedTextFiles(output);
    expect(generatedText).not.toMatch(/(^|[\s"'(])([A-Za-z]:[\\/](?![\\/]))/);
    expect(generatedText).not.toContain("/home/");
    expect(generatedText).not.toContain("/Users/");
    expect(generatedText).not.toContain("/mnt/");
    expect(generatedText).not.toContain("file://");
  });
});

function loadConfigFromObject(value: unknown) {
  return QualityReportConfigSchema.parse(value);
}
