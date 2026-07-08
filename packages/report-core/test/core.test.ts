import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  escapeMarkdownTableCell,
  formatInlineCode,
  publishModeDeploysPages,
  publishModeUploadsArtifact,
  renderFullPrComment,
  renderMinimalPrComment,
  resolvePrCommentMode,
  resolvePublishMode,
  resolveQualityProfile,
  QualityReportConfigSchema,
  type NormalizedReport,
  type NormalizedTestCase,
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
  it("deduplicates retries and keeps failing status", () => {
    const result = deduplicateTests([test({ status: "passed" }), test({ status: "failed" })]);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("failed");
    expect(result[0]?.retries).toBe(1);
  });

  it("calculates requirement coverage", () => {
    const result = calculateRequirementCoverage(["JIRA-1", "JIRA-2"], [test({})]);
    expect(result.percentage).toBe(50);
    expect(result.missing).toEqual(["JIRA-2"]);
  });

  it("evaluates quality gates", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1"], [test({})]);
    const summary = buildSummary([test({ status: "failed" })], [], requirements, []);
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
    expect(evaluateQualityGate(config, summary).status).toBe("failed");
  });

  it("uses strict quality gate defaults", () => {
    const config = QualityReportConfigSchema.parse({ project: { name: "x" } });
    expect(config.qualityGates.tests.allowFailed).toBe(0);
    expect(config.qualityGates.tests.allowBroken).toBe(0);
    expect(config.qualityGates.security.maxCritical).toBe(0);
    expect(config.qualityGates.security.maxHigh).toBe(0);
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
    expect(resolveQualityProfile("pr", { profiles: { pr: { extends: "standard", coverage: { totalMinimum: 75 } } } }).qualityGates.coverage.totalMinimum).toBe(75);
    expect(() => resolveQualityProfile("missing")).toThrow(/Unknown quality gate profile/);
  });

  it("skips quality gate evaluation for the off profile", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1"], [test({})]);
    const summary = buildSummary([test({ status: "failed" })], [], requirements, []);
    const resolved = resolveQualityProfile("off");
    const config = QualityReportConfigSchema.parse({ project: { name: "x" }, qualityGates: resolved.qualityGates });
    expect(evaluateQualityGate(config, summary, [], { profile: "off", enabled: resolved.enabled }).status).toBe("skipped");
  });

  it("resolves publish and PR comment modes by event", () => {
    expect(resolvePublishMode("auto", { eventName: "pull_request" })).toBe("none");
    expect(resolvePrCommentMode("auto", { eventName: "pull_request" })).toBe("minimal");
    expect(resolvePrCommentMode("auto", { isPullRequest: true })).toBe("minimal");
    expect(resolvePublishMode("auto", { eventName: "workflow_dispatch" })).toBe("pages-and-artifact");
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
    expect(formatInlineCode("backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test")).toBe(
      "`backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test`"
    );
    expect(formatInlineCode("name with `backtick`")).toBe("`` name with `backtick` ``");
    expect(formatInlineCode("line one\nline two")).toBe("`line one line two`");
    expect(escapeMarkdownTableCell("left | right")).toBe("left \\| right");
  });

  it("renders safe compact and capped full PR comments", () => {
    const requirements = calculateRequirementCoverage(["JIRA-1", "JIRA-2"], [test({ name: "danger <b>x</b>" })]);
    const summary = buildSummary([test({ status: "failed", name: "bad | test", retries: 1 })], [], requirements, [
      { id: "s1", tool: "zap", title: "XSS *finding*", severity: "high", tags: [] }
    ]);
    const config = QualityReportConfigSchema.parse({ project: { name: "x" } });
    const longName = `backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test ${"x".repeat(400)}`;
    const report: NormalizedReport = {
      schemaVersion: "1.0",
      metadata: { projectName: "x", generatedAt: new Date(0).toISOString(), qualityProfile: "standard" },
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
    expect(minimal).toContain("backend.user.UserServiceTest > rejects duplicate email JIRA-102 / src:test");
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
    const workflow = await readFile(path.join(root, ".github/workflows/publish-quality-report.yml"), "utf8");
    expect(workflow).toContain("pull_request|pull_request_target) publish=\"none\"");
    expect(workflow).toContain("workflow_dispatch|release) publish=\"pages-and-artifact\"");
    expect(workflow).toContain("merge_group) publish=\"artifact\"");
    expect(workflow).toContain("if: steps.modes.outputs.publish-mode == 'artifact' || steps.modes.outputs.publish-mode == 'pages-and-artifact'");
    expect(workflow).toContain("if: steps.modes.outputs.publish-mode == 'pages' || steps.modes.outputs.publish-mode == 'pages-and-artifact'");
    expect(workflow).toContain("if: steps.modes.outputs.pr-comment-mode != 'off'");
    expect(workflow).toContain("github.rest.issues.updateComment");
    expect(workflow).toContain("github.rest.issues.createComment");
    expect(workflow).toContain("PR comment requested, but this run has no pull request context. Skipping.");
    expect(workflow.indexOf("id: comment")).toBeGreaterThan(workflow.indexOf("uses: actions/upload-artifact@v4"));
    expect(workflow.indexOf("Fail after publication if quality gate failed")).toBeGreaterThan(workflow.indexOf("id: comment"));
  });
});
