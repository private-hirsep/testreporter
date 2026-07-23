import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QualityReportConfigSchema } from "@quality-report/report-core";
import { BUILT_IN_QUALITY_PROFILES, loadConfig } from "../src/config.js";
import { buildReport } from "../src/generator.js";
import { TOOL_VERSION } from "../src/version.js";

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
  it("uses completed chronological approved manual evidence and validates all evidence references", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-manual-corrections-"));
    const input = path.join(temp, "input");
    const output = path.join(temp, "output");
    await mkdir(path.join(input, "cases"), { recursive: true });
    await mkdir(path.join(input, "results"), { recursive: true });
    await mkdir(path.join(input, "evidence"), { recursive: true });
    await mkdir(path.join(input, "requirements"), { recursive: true });
    await mkdir(path.join(input, "tests"), { recursive: true });
    await writeFile(path.join(input, "requirements", "expected.csv"), "key\nREQ-1\nREQ-2\n");
    await writeFile(
      path.join(input, "tests", "results.xml"),
      '<testsuite><testcase classname="Automated" name="covers REQ-2" /></testsuite>'
    );
    await writeFile(
      path.join(input, "evidence", "missing-step.png"),
      "same basename, different reference"
    );
    await writeFile(
      path.join(input, "cases", "approved.yml"),
      "id: APP-MT-1\ntitle: Approved\nstatus: approved\nrequirements: [REQ-1]\nsteps:\n  - action: Act\n    expected: Observe\n"
    );
    await writeFile(
      path.join(input, "cases", "approved-2.yml"),
      "id: APP-MT-3\ntitle: Approved later\nstatus: approved\nrequirements: [REQ-1]\nsteps:\n  - action: Act\n    expected: Observe\n"
    );
    await writeFile(
      path.join(input, "cases", "approved-unexecuted.yml"),
      "id: APP-MT-4\ntitle: Approved unexecuted\nstatus: approved\nrequirements: [REQ-2]\nsteps:\n  - action: Act\n    expected: Observe\n"
    );
    await writeFile(
      path.join(input, "cases", "draft.yml"),
      "id: APP-MT-2\ntitle: Draft\nstatus: draft\nrequirements: [REQ-1]\nsteps:\n  - action: Act\n    expected: Observe\n"
    );
    const result = (
      executionId: string,
      state: "draft" | "completed",
      completedAt: string | undefined,
      status: "passed" | "failed"
    ) => ({
      schemaVersion: "1.0",
      executionId,
      projectKey: "APP",
      testedBuild: "build",
      environment: "test",
      tester: "tester",
      startedAt: "2026-01-01T00:00:00.000Z",
      ...(completedAt ? { completedAt } : {}),
      state,
      cases: [
        {
          caseId: "APP-MT-1",
          status,
          steps: [{ index: 0, status, evidence: ["missing-step.png"] }],
          defects: [],
          evidence: []
        }
      ]
    });
    await writeFile(
      path.join(input, "results", "newer.json"),
      JSON.stringify(result("newer", "completed", "2026-01-03T00:00:00.000Z", "failed"))
    );
    await writeFile(
      path.join(input, "results", "older.json"),
      JSON.stringify(result("older", "completed", "2026-01-02T00:00:00.000Z", "passed"))
    );
    await writeFile(
      path.join(input, "results", "draft.json"),
      JSON.stringify(result("draft", "draft", undefined, "passed"))
    );
    const latest = {
      ...result("latest", "completed", "2026-01-04T00:00:00.000Z", "passed"),
      cases: [
        {
          caseId: "APP-MT-3",
          status: "passed",
          steps: [{ index: 0, status: "passed", evidence: [] }],
          defects: [],
          evidence: []
        }
      ]
    };
    const equalTimestamp = {
      ...result("aaa-equal", "completed", "2026-01-04T00:00:00.000Z", "failed"),
      cases: [
        {
          caseId: "APP-MT-3",
          status: "failed",
          steps: [{ index: 0, status: "failed", evidence: [] }],
          defects: [],
          evidence: []
        }
      ]
    };
    await writeFile(path.join(input, "results", "equal.json"), JSON.stringify(equalTimestamp));
    await writeFile(path.join(input, "results", "latest.json"), JSON.stringify(latest));
    const unknown = {
      ...result("unknown", "completed", "2026-01-05T00:00:00.000Z", "passed"),
      cases: [
        {
          caseId: "APP-MT-404",
          status: "passed",
          steps: [{ index: 0, status: "passed", evidence: [] }],
          defects: [],
          evidence: []
        }
      ]
    };
    await writeFile(path.join(input, "results", "unknown.json"), JSON.stringify(unknown));
    const config = loadConfigFromObject({
      project: { name: "APP" },
      artifacts: {
        tests: { backend: { junit: "tests/*.xml" } },
        manual: { cases: "cases/*.yml", results: "results/*.json", evidence: "evidence/*" },
        requirements: { expectedKeys: "requirements/expected.csv" }
      },
      requirements: { keyPattern: "REQ-[0-9]+" },
      qualityGates: { manual: { failOnFailed: true, requireCompleted: true } }
    });
    const report = await buildReport({
      config,
      configPath: "quality-report.yml",
      inputPath: input,
      outputPath: output
    });
    expect(report.manualExecutions.map((item) => item.executionId)).toEqual([
      "older",
      "newer",
      "aaa-equal",
      "latest"
    ]);
    expect(report.summary.manual).toMatchObject({
      cases: 3,
      passed: 1,
      failed: 1,
      notRun: 1,
      missingEvidence: 1
    });
    expect(report.requirements.manualCasesByRequirement["REQ-1"]).toEqual(["APP-MT-1", "APP-MT-3"]);
    expect(report.requirements.latestManualResultByRequirement["REQ-1"]).toBe("failed");
    expect(report.requirements.covered).not.toContain("REQ-1");
    expect(report.requirements.evidenceTypeByRequirement["REQ-2"]).toBe("automated");
    expect(report.qualityGate.checks.find((check) => check.id === "manual.failed")?.status).toBe(
      "failed"
    );
    expect(report.downloads.some((item) => item.name === "draft.json")).toBe(false);
    expect(report.downloads.some((item) => item.name === "unknown.json")).toBe(false);
    expect(
      report.warnings.some((item) => item.code === "manual.execution.definition-mismatch")
    ).toBe(true);
  });
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
      release: "9.9.9",
      qualityProfile: "relaxed",
      publishMode: "artifact",
      prCommentMode: "minimal",
      prCommentMarker: "<!-- quality-report-platform:summary -->"
    });
    expect(report.tests.length).toBeGreaterThan(0);
    expect(report.testCaseCatalogue?.length).toBeGreaterThan(0);
    expect(report.testCaseCatalogue?.some((item) => item.type === "hybrid")).toBe(true);
    expect(report.identityDiagnostics.duplicateCanonicalIds).not.toContain("SHOP-TC-0043");
    expect(report.identityDiagnostics.multiImplementationCanonicalIds).toContain("SHOP-TC-0043");
    expect(report.identityDiagnostics.conflictingCanonicalIds).toContain("SHOP-TC-0042");
    expect(report.unifiedExecutions?.filter((item) => item.type === "automated")).toHaveLength(1);
    expect(report.unifiedExecutions?.filter((item) => item.type === "manual").length).toBeGreaterThan(
      1
    );
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
    expect(
      report.warnings.some((warning) => warning.code === "release-scope.release-mismatch")
    ).toBe(true);
    expect(
      report.readiness?.actions.some((action) => action.type === "release-scope-mismatch")
    ).toBe(true);
    expect(report.requirements.testsByRequirement["JIRA-101"]?.length).toBeGreaterThan(0);
    expect(report.security.some((finding) => finding.helpUri || finding.evidence)).toBe(true);
    await assertFullHtml(output);
    await assertManifestReferencesExist(output);
    await expect(stat(path.join(output, "assets", "stale.js"))).rejects.toThrow();
    const reportZips = (await readdir(output)).filter((file) =>
      /^quality-report.*\.zip$/i.test(file)
    );
    expect(reportZips).toEqual(["quality-report.zip"]);
    const manifest = JSON.parse(
      await readFile(path.join(output, "data/manifest.json"), "utf8")
    ) as {
      metadata: { qualityProfile?: string; publishMode?: string; prCommentMode?: string };
    };
    const summary = JSON.parse(
      await readFile(path.join(output, "meta/quality-summary.json"), "utf8")
    ) as {
      publishMode?: string;
      prCommentMode?: string;
    };
    const minimalComment = await readFile(path.join(output, "meta/pr-comment-minimal.md"), "utf8");
    const fullComment = await readFile(path.join(output, "meta/pr-comment-full.md"), "utf8");
    expect(manifest.metadata.qualityProfile).toBe("relaxed");
    expect(manifest.metadata.publishMode).toBe("artifact");
    expect(manifest.metadata.prCommentMode).toBe("minimal");
    expect(summary.publishMode).toBe("artifact");
    expect(summary.prCommentMode).toBe("minimal");
    expect(minimalComment.startsWith("<!-- quality-report-platform:summary -->")).toBe(true);
    expect(fullComment.startsWith("<!-- quality-report-platform:summary -->")).toBe(true);
    const evidence = JSON.parse(
      await readFile(path.join(output, "evidence-manifest.json"), "utf8")
    ) as {
      toolVersion: string;
      requirements: {
        covered: number;
        expected: number;
        included: number;
        uncovered: number;
        excluded: number;
        total: number;
      };
      includedEvidence: Array<{ path: string; sha256: string }>;
    };
    expect(evidence.toolVersion).toBe(TOOL_VERSION);
    expect(evidence.requirements).toEqual({
      covered: report.readiness!.requirements.covered,
      expected:
        report.readiness!.requirements.covered + report.readiness!.requirements.uncovered,
      included:
        report.readiness!.requirements.covered + report.readiness!.requirements.uncovered,
      uncovered: report.readiness!.requirements.uncovered,
      excluded: report.readiness!.requirements.excluded,
      total:
        report.readiness!.requirements.covered +
        report.readiness!.requirements.uncovered +
        report.readiness!.requirements.excluded
    });
    expect(evidence.includedEvidence.length).toBeGreaterThan(0);
    expect(evidence.includedEvidence.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(
      true
    );
    expect(evidence.includedEvidence.map((item) => item.path)).toEqual(
      expect.arrayContaining(["index.html", "data/manifest.json", "normalized-report.json"])
    );
    const checksumLines = (await readFile(path.join(output, "checksums.sha256"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
        expect(match).not.toBeNull();
        return { hash: match![1]!, file: match![2]! };
      });
    expect(checksumLines.map((item) => item.file)).toEqual(
      [...evidence.includedEvidence.map((item) => item.path), "evidence-manifest.json"].sort(
        (left, right) => left.localeCompare(right)
      )
    );
    for (const item of checksumLines) {
      const actual = createHash("sha256")
        .update(await readFile(path.join(output, item.file)))
        .digest("hex");
      expect(actual, item.file).toBe(item.hash);
    }
    await expect(stat(path.join(output, "project-quality-summary.json"))).resolves.toBeTruthy();
  });

  it("falls back to the release-scope release when report metadata has no release", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-release-fallback-"));
    const input = path.join(temp, "input");
    const output = path.join(temp, "output");
    const configPath = path.join(temp, "quality-report.yml");
    await mkdir(input);
    await writeFile(
      path.join(temp, "release-scope.yml"),
      "release: 4.2.0\nrequirements: []\nrequiredManualCases: []\n"
    );
    const previousRelease = process.env.QR_RELEASE;
    delete process.env.QR_RELEASE;
    try {
      const report = await buildReport({
        config: loadConfigFromObject({
          project: { name: "Release fallback" },
          release: { scope: "release-scope.yml" }
        }),
        configPath,
        inputPath: input,
        outputPath: output
      });
      expect(report.metadata.release).toBe("4.2.0");
      expect(report.releaseScope?.release).toBe("4.2.0");
      expect(
        report.warnings.some((warning) => warning.code === "release-scope.release-mismatch")
      ).toBe(false);
    } finally {
      if (previousRelease === undefined) delete process.env.QR_RELEASE;
      else process.env.QR_RELEASE = previousRelease;
    }
  });

  it("keeps built-in profiles and custom quality-gate fields typed", async () => {
    expect(BUILT_IN_QUALITY_PROFILES.strict.requirements?.failOnExtra).toBe(true);
    expect(BUILT_IN_QUALITY_PROFILES.relaxed.security?.maxMedium).toBe(10);
    const root = path.resolve(import.meta.dirname, "../../..");
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath, {
      qualityGatesPath: path.join(root, "examples/minimal/quality-gates.yml"),
      qualityProfile: "dogfood-strict"
    });
    expect(config.qualityGates.requirements.failOnExtra).toBe(true);
    expect(config.qualityGates.security.maxMedium).toBe(0);
    expect(config.qualityGates.warnings.maxWarnings).toBe(0);
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
    expect(zipFiles).toEqual(["quality-report.zip"]);
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
    expect(entriesInZip).toContain("evidence-manifest.json");
    expect(entriesInZip).toContain("checksums.sha256");
    expect(entriesInZip).toContain("normalized-report.json");
    expect(entriesInZip).toContain("project-quality-summary.json");
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
    await writeFile(
      path.join(input, "requirements", "expected.csv"),
      "key\nJIRA-1\nJIRA-2\nJIRA-2\n"
    );
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

  it("applies the most-specific external test mapping and warns on ambiguity", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-mapping-"));
    const input = path.join(temp, "input");
    const output = path.join(temp, "output");
    await mkdir(path.join(input, "tests"), { recursive: true });
    await writeFile(
      path.join(input, "tests", "results.xml"),
      '<testsuite><testcase classname="Suite" name="mapped" file="mapped.ts"/><testcase classname="Suite" name="ambiguous"/></testsuite>'
    );
    await writeFile(
      path.join(input, "tests", "mapping.json"),
      JSON.stringify([
        {
          match: { title: "mapped" },
          canonicalId: "APP-TC-1",
          requirements: ["REQ-1"],
          defects: ["BUG-1"],
          tags: ["audit"]
        },
        {
          match: { framework: "junit", title: "mapped" },
          canonicalId: "APP-TC-2",
          requirements: ["REQ-2"],
          defects: ["BUG-2"],
          tags: ["critical"]
        },
        { match: { title: "ambiguous" }, canonicalId: "APP-TC-3" },
        { match: { title: "ambiguous" }, canonicalId: "APP-TC-4" }
      ])
    );
    const config = loadConfigFromObject({
      project: { name: "Mapping" },
      artifacts: {
        tests: { mapping: "tests/mapping.json", backend: { junit: "tests/results.xml" } }
      },
      requirements: { keyPattern: "REQ-[0-9]+" }
    });
    const report = await buildReport({
      config,
      configPath: "quality-report.yml",
      inputPath: input,
      outputPath: output
    });
    const mapped = report.tests.find((item) => item.name === "mapped")!;
    expect(mapped.identity).toMatchObject({
      canonicalId: "APP-TC-2",
      source: "mapping",
      stable: true
    });
    expect(mapped.requirements).toEqual(["REQ-2"]);
    expect(mapped.defects).toEqual(["BUG-2"]);
    expect(mapped.tags).toEqual(["critical"]);
    expect(report.warnings.some((warning) => warning.code === "identity.mapping.ambiguous")).toBe(
      true
    );
    expect(report.identityDiagnostics.ambiguousMappings).toBe(1);
  });

  it("rejects invalid mapping entries without affecting valid entries", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-report-invalid-mapping-"));
    const input = path.join(temp, "input");
    const output = path.join(temp, "output");
    await mkdir(path.join(input, "tests"), { recursive: true });
    await writeFile(
      path.join(input, "tests", "results.xml"),
      '<testsuite><testcase classname="Suite" name="valid"/><testcase classname="Suite" name="invalid"/></testsuite>'
    );
    await writeFile(
      path.join(input, "tests", "mapping.json"),
      JSON.stringify([
        {
          match: { title: "valid" },
          canonicalId: "APP-TC-7",
          requirements: ["REQ-7"],
          links: [{ label: "Notes", url: "https://example.test/note" }]
        },
        { match: {}, canonicalId: "APP-TC-8" },
        { match: { title: "invalid" }, canonicalId: "prefix-APP-TC-8-suffix" },
        { match: { title: "invalid" }, requirements: "REQ-8" },
        { match: { title: "invalid" }, defects: ["BUG-8", 9] },
        { match: { title: "invalid" }, tags: null },
        { match: { title: "invalid" }, links: "not-an-array" },
        { match: { title: "invalid" }, links: [{ label: "Unsafe", url: "javascript:alert(1)" }] }
      ])
    );
    const config = loadConfigFromObject({
      project: { name: "Invalid mapping" },
      artifacts: {
        tests: { mapping: "tests/mapping.json", backend: { junit: "tests/results.xml" } }
      },
      identity: { idPattern: "APP-TC-[0-9]+" },
      requirements: { keyPattern: "REQ-[0-9]+" },
      links: { requirement: { baseUrl: "https://example.test/browse" } }
    });
    const report = await buildReport({
      config,
      configPath: "quality-report.yml",
      inputPath: input,
      outputPath: output
    });
    const valid = report.tests.find((item) => item.name === "valid")!;
    expect(valid.identity).toMatchObject({ canonicalId: "APP-TC-7", source: "mapping" });
    expect(valid.links.map((link) => link.url)).toEqual([
      "https://example.test/note",
      "https://example.test/browse/REQ-7"
    ]);
    expect(report.tests.find((item) => item.name === "invalid")?.identity?.source).toBe(
      "generated"
    );
    expect(
      report.warnings.filter((warning) => warning.code === "identity.mapping.invalid-entry")
    ).toHaveLength(7);
  });
});

function loadConfigFromObject(value: unknown) {
  return QualityReportConfigSchema.parse(value);
}
