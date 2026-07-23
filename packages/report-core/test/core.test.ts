import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  escapeMarkdownTableCell,
  extractRequirementKeys,
  formatInlineCode,
  publishModeDeploysPages,
  publishModeUploadsArtifact,
  renderFullPrComment,
  renderMinimalPrComment,
  resolvePrCommentMode,
  resolvePublishMode,
  resolveQualityProfile,
  testIdentity,
  calculateIdentityDiagnostics,
  NormalizedReportSchema,
  QualityReportConfigSchema,
  type QualityGateConfig,
  type NormalizedReport,
  type NormalizedTestCase,
  type SecurityFinding,
  type QualityReportConfig
} from "../src/index.js";

function test(overrides: Partial<NormalizedTestCase>): NormalizedTestCase {
  return {
    id: overrides.id ?? "id",
    name: overrides.name ?? "test JIRA-1",
    framework: "junit",
    layer: "backend",
    status: "passed",
    retries: 0,
    requirements: ["JIRA-1"],
    labels: {},
    attachments: [],
    ...overrides
  };
}

describe("core normalization and gates", () => {
  it("deduplicates retries by stable identity and keeps latest final status", () => {
    const result = deduplicateTests([
      test({
        status: "failed",
        durationMs: 10,
        requirements: ["JIRA-1"],
        attachments: [{ name: "trace", path: "trace.zip" }]
      }),
      test({ status: "passed", durationMs: 12, requirements: ["JIRA-2"] })
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("passed");
    expect(result[0]?.retries).toBe(1);
    expect(result[0]?.requirements).toEqual(["JIRA-1", "JIRA-2"]);
    expect(result[0]?.attachments).toHaveLength(1);
    expect(result[0]?.id).toBe(testIdentity(result[0]!));
  });

  it("isolates retries within identical execution variants", () => {
    const chromium = { project: "desktop", browser: "chromium" };
    const firefox = { project: "desktop", browser: "firefox" };
    const result = deduplicateTests([
      test({ status: "failed", variant: chromium, retries: 0 }),
      test({ status: "passed", variant: chromium, retries: 1 }),
      test({ status: "failed", variant: firefox, retries: 2 })
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((item) => [item.variant?.browser, item.status, item.retries])).toEqual([
      ["chromium", "passed", 1],
      ["firefox", "failed", 2]
    ]);
    expect(result[0]?.id).not.toBe(result[1]?.id);
  });

  it("reports duplicate canonical IDs without deduplicating distinct technical tests", () => {
    const tests = [
      test({
        name: "one",
        file: "one.ts",
        identity: { canonicalId: "APP-TC-1", technicalId: "a", source: "explicit", stable: true }
      }),
      test({
        name: "two",
        file: "two.ts",
        identity: { canonicalId: "APP-TC-1", technicalId: "b", source: "explicit", stable: true }
      })
    ];
    const deduped = deduplicateTests(tests);
    expect(deduped).toHaveLength(2);
    expect(calculateIdentityDiagnostics(deduped).duplicateExplicitIds).toEqual(["APP-TC-1"]);
  });

  it("parses legacy schema 1.0 reports with defaulted identity diagnostics", () => {
    const requirements = calculateRequirementCoverage([], []);
    const config = QualityReportConfigSchema.parse({ project: { name: "legacy" } });
    const summary = buildSummary([], [], requirements, []);
    const parsed = NormalizedReportSchema.parse({
      schemaVersion: "1.0",
      metadata: { projectName: "legacy", generatedAt: new Date(0).toISOString() },
      summary,
      tests: [],
      coverage: [],
      requirements,
      security: [],
      qualityGate: evaluateQualityGate(config, summary),
      downloads: [],
      warnings: []
    });
    expect(parsed.identityDiagnostics.total).toBe(0);
  });

  it("extracts and calculates requirement coverage deterministically", () => {
    expect(extractRequirementKeys("JIRA-2 JIRA-1 JIRA-2", /JIRA-[0-9]+/g)).toEqual([
      "JIRA-2",
      "JIRA-1"
    ]);
    const result = calculateRequirementCoverage(
      ["JIRA-2", "JIRA-1", "JIRA-1", "JIRA-3"],
      [
        test({ id: "a", requirements: ["JIRA-1", "JIRA-2"] }),
        test({ id: "b", name: "other", requirements: ["JIRA-2", "JIRA-99"] })
      ]
    );
    expect(result.expected).toEqual(["JIRA-1", "JIRA-2", "JIRA-3"]);
    expect(result.covered).toEqual(["JIRA-1", "JIRA-2"]);
    expect(result.missing).toEqual(["JIRA-3"]);
    expect(result.extra).toEqual(["JIRA-99"]);
    expect(result.percentage).toBe(66.67);
    expect(result.testsByRequirement["JIRA-2"]).toEqual(["a", "b"]);
  });

  it("evaluates default strict failed, broken, and security quality gates", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1"], [test({})]);
    const security: SecurityFinding[] = [
      { id: "s1", tool: "codeql", title: "critical", severity: "critical", tags: [] },
      { id: "s2", tool: "zap", title: "high", severity: "high", tags: [] }
    ];
    const summary = buildSummary(
      [test({ status: "failed" }), test({ name: "broken", status: "broken" })],
      [],
      requirements,
      security
    );
    const config = {
      project: { name: "x" },
      artifacts: {},
      requirements: { keyPattern: "[A-Z]+-[0-9]+" },
      qualityGates: {
        tests: { allowFailed: 0, allowBroken: 0 },
        coverage: {},
        requirements: { failOnMissing: false, failOnExtra: false },
        security: { maxCritical: 0, maxHigh: 0, maxMedium: 3 },
        warnings: { maxWarnings: 10 }
      }
    } satisfies QualityReportConfig;
    const result = evaluateQualityGate(config, summary);
    expect(result.status).toBe("failed");
    expect(
      result.checks.filter((check) => check.status === "failed").map((check) => check.id)
    ).toEqual(["tests.failed", "tests.broken", "security.critical", "security.high"]);
  });

  it("uses strict quality gate defaults", () => {
    const config = QualityReportConfigSchema.parse({ project: { name: "x" } });
    expect(config.qualityGates.tests.allowFailed).toBe(0);
    expect(config.qualityGates.tests.allowBroken).toBe(0);
    expect(config.qualityGates.security.maxCritical).toBe(0);
    expect(config.qualityGates.security.maxHigh).toBe(0);
  });

  it("accepts extended custom quality gate fields", () => {
    const gates = {
      requirements: { failOnExtra: true },
      security: { maxMedium: 0, maxLow: null },
      warnings: { maxWarnings: 0 }
    } satisfies QualityGateConfig;
    const config = QualityReportConfigSchema.parse({ project: { name: "x" }, qualityGates: gates });
    expect(config.qualityGates.requirements.failOnExtra).toBe(true);
    expect(config.qualityGates.security.maxMedium).toBe(0);
    expect(config.qualityGates.security.maxLow).toBeNull();
    expect(config.qualityGates.warnings.maxWarnings).toBe(0);
  });

  it("evaluates skipped tests, extra requirements, medium security, low security, and warnings gates", () => {
    const requirements = calculateRequirementCoverage([], [test({ requirements: ["JIRA-9"] })]);
    const summary = buildSummary([test({ status: "skipped" })], [], requirements, [
      { id: "s1", tool: "codeql", title: "Finding", severity: "medium", tags: [] },
      { id: "s2", tool: "codeql", title: "Low finding", severity: "low", tags: [] }
    ]);
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: {
        tests: { allowSkipped: 0 },
        requirements: { failOnExtra: true },
        security: { maxMedium: 0, maxLow: 0 },
        warnings: { maxWarnings: 0 }
      }
    });
    const result = evaluateQualityGate(config, summary, [
      { code: "parser.warn", message: "warning" }
    ]);
    expect(
      result.checks.some((check) => check.id === "tests.skipped" && check.status === "failed")
    ).toBe(true);
    expect(
      result.checks.some((check) => check.id === "requirements.extra" && check.status === "failed")
    ).toBe(true);
    expect(
      result.checks.some((check) => check.id === "security.medium" && check.status === "failed")
    ).toBe(true);
    expect(
      result.checks.some((check) => check.id === "security.low" && check.status === "failed")
    ).toBe(true);
    expect(
      result.checks.some(
        (check) => check.id === "warnings.maxWarnings" && check.status === "failed"
      )
    ).toBe(true);
  });

  it("allows configured relaxed quality gates", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1"], [test({})]);
    const summary = buildSummary([test({ status: "failed" })], [], requirements, []);
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: {
        tests: { allowFailed: 1, allowBroken: 0 },
        security: { maxCritical: 0, maxHigh: 0 }
      }
    });
    expect(evaluateQualityGate(config, summary).status).toBe("passed");
  });

  it("resolves built-in and custom quality gate profiles", () => {
    expect(resolveQualityProfile("relaxed").qualityGates.tests.allowFailed).toBe(3);
    const custom = resolveQualityProfile("merge-queue", {
      profiles: {
        "merge-queue": { extends: "strict" },
        pr: { extends: "standard", coverage: { totalMinimum: 75 } }
      }
    });
    expect(custom.qualityGates.requirements.failOnExtra).toBe(true);
    expect(
      resolveQualityProfile("pr", {
        profiles: { pr: { extends: "standard", coverage: { totalMinimum: 75 } } }
      }).qualityGates.coverage.totalMinimum
    ).toBe(75);
    expect(() => resolveQualityProfile("missing")).toThrow(/Unknown quality gate profile/);
  });

  it("skips quality gate evaluation for the off profile", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1"], [test({})]);
    const summary = buildSummary([test({ status: "failed" })], [], requirements, []);
    const resolved = resolveQualityProfile("off");
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: resolved.qualityGates
    });
    expect(
      evaluateQualityGate(config, summary, [], { profile: "off", enabled: resolved.enabled }).status
    ).toBe("skipped");
  });

  it("resolves publish and PR comment modes by event", () => {
    expect(resolvePublishMode("auto", { eventName: "pull_request" })).toBe("none");
    expect(resolvePrCommentMode("auto", { eventName: "pull_request" })).toBe("minimal");
    expect(resolvePrCommentMode("auto", { isPullRequest: true })).toBe("minimal");
    expect(resolvePublishMode("auto", { eventName: "workflow_dispatch" })).toBe(
      "pages-and-artifact"
    );
    expect(resolvePublishMode("auto", { eventName: "release" })).toBe("pages-and-artifact");
    expect(resolvePublishMode("auto", { eventName: "merge_group" })).toBe("artifact");
    expect(resolvePrCommentMode("auto", { eventName: "merge_group" })).toBe("off");
    expect(resolvePrCommentMode("auto", { eventName: "workflow_dispatch" })).toBe("off");
    expect(publishModeUploadsArtifact("artifact")).toBe(true);
    expect(publishModeUploadsArtifact("pages")).toBe(false);
    expect(publishModeDeploysPages("pages")).toBe(true);
    expect(publishModeDeploysPages("artifact")).toBe(false);
  });

  it("formats markdown values without over-escaping inline code", () => {
    expect(
      formatInlineCode("backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test")
    ).toBe("`backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test`");
    expect(formatInlineCode("name with `backtick`")).toBe("`` name with `backtick` ``");
    expect(formatInlineCode("line one\nline two")).toBe("`line one line two`");
    expect(escapeMarkdownTableCell("left | right")).toBe("left \\| right");
  });

  it("renders safe compact and capped full PR comments", () => {
    const requirements = calculateRequirementCoverage(
      ["JIRA-1", "JIRA-2"],
      [test({ name: "danger <b>x</b>" })]
    );
    const summary = buildSummary(
      [test({ status: "failed", name: "bad | test", retries: 1 })],
      [],
      requirements,
      [{ id: "s1", tool: "zap", title: "XSS *finding*", severity: "high", tags: [] }]
    );
    const config = QualityReportConfigSchema.parse({ project: { name: "x" } });
    const longName = `backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test ${"x".repeat(400)}`;
    const report: NormalizedReport = {
      schemaVersion: "1.0",
      metadata: {
        projectName: "x",
        generatedAt: new Date(0).toISOString(),
        qualityProfile: "standard"
      },
      summary,
      tests: [
        test({
          status: "failed",
          name: "bad | test",
          fullName: longName,
          retries: 1,
          durationMs: 123
        }),
        test({
          id: "id-2",
          status: "broken",
          name: "[link](https://example.test) <b>html</b> `tick` JIRA-77",
          fullName: "[link](https://example.test) <b>html</b> `tick` JIRA-77",
          durationMs: 50
        })
      ],
      coverage: [],
      requirements,
      security: [{ id: "s1", tool: "zap", title: "XSS *finding*", severity: "high", tags: [] }],
      qualityGate: {
        ...evaluateQualityGate(config, summary, [], { profile: "standard" }),
        checks: [
          ...evaluateQualityGate(config, summary, [], { profile: "standard" }).checks,
          {
            id: "coverage.example",
            label: "Coverage example",
            status: "failed",
            actual: 72.44,
            expected: ">= 70%"
          }
        ]
      },
      downloads: [],
      history: { runs: [] },
      warnings: [
        { code: "parser.warn", message: "bad /tmp/secret", sourcePath: "relative.xml" },
        { code: "parser.warn2", message: "second warning", sourcePath: "relative2.xml" }
      ]
    };
    const minimal = renderMinimalPrComment(report, {
      marker: "<!-- quality-report-platform:summary -->",
      maxItems: 2,
      publishMode: "none"
    });
    const full = renderFullPrComment(report, {
      marker: "<!-- quality-report-platform:summary -->",
      maxItems: 1,
      publishMode: "artifact",
      prCommentMode: "full",
      artifactName: "quality-report"
    });
    expect(minimal).toContain("<!-- quality-report-platform:summary -->");
    expect(minimal).toContain("**Gate:** Failed");
    expect(minimal).toContain("**Profile:** `standard`");
    expect(minimal).toContain(
      "backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test"
    );
    expect(minimal).toContain("``[link](https://example.test) &lt;b>html&lt;/b> `tick` JIRA-77``");
    expect(minimal).not.toContain("backend\\.user");
    expect(minimal).toContain("Full report: not published for this run.");
    expect(full).toContain("72.44 / >= 70%");
    expect(full).toContain("Publish mode: `artifact`");
    expect(full).toContain("PR comment mode: `full`");
    expect(full).toContain("workflow artifact `quality-report`");
    expect(full).not.toContain("<b>");
    expect(full).not.toContain("[link](https://example.test)");
    expect(minimal).not.toContain("<b>");
    expect(full).not.toContain("/tmp/secret");
    expect(full).not.toContain("ghp_");
    expect(full).toContain("more item(s) omitted");
  });

  it("keeps reusable workflow conditionals and delayed gate failure in place", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const workflow = await readFile(
      path.join(root, ".github/workflows/publish-quality-report.yml"),
      "utf8"
    );
    expect(workflow).toContain('if [[ "$publish_mode" == "auto" ]]');
    expect(workflow).toContain('publish_mode="artifact"');
    expect(workflow).toContain('publish_mode="pages-and-artifact"');
    expect(workflow).toContain('pr_comment_mode="minimal"');
    expect(workflow).toContain(
      "if: steps.resolve.outputs.publish-mode == 'artifact' || steps.resolve.outputs.publish-mode == 'pages-and-artifact'"
    );
    expect(workflow).toContain(
      "if: steps.resolve.outputs.publish-mode == 'pages' || steps.resolve.outputs.publish-mode == 'pages-and-artifact'"
    );
    expect(workflow).toContain("steps.resolve.outputs.pr-comment-mode != 'off'");
    expect(workflow).toContain('gh api --method PATCH "repos/$REPO/issues/comments/$existing"');
    expect(workflow).toContain('gh api --method POST "repos/$REPO/issues/$PR_NUMBER/comments"');
    expect(workflow).toContain(
      "PR comment mode is ${{ steps.resolve.outputs.pr-comment-mode }}, but this is not a pull_request event; skipping comment."
    );
    expect(workflow.indexOf("id: pr-comment")).toBeGreaterThan(
      workflow.indexOf("uses: actions/upload-artifact@v4")
    );
    expect(workflow.indexOf("Fail on quality gate")).toBeGreaterThan(
      workflow.indexOf("id: pr-comment")
    );
  });
});
