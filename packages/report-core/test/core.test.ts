import { describe, expect, it } from "vitest";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  QualityReportConfigSchema,
  type QualityGateConfig,
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
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: {
        tests: { allowFailed: 0, allowBroken: 0 },
        security: { maxCritical: 0, maxHigh: 0 }
      }
    }) satisfies QualityReportConfig;
    expect(evaluateQualityGate(config, summary).status).toBe("failed");
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
    expect(config.qualityGates.warnings.maxWarnings).toBe(0);
  });

  it("evaluates extra requirements, medium security, and warnings gates", () => {
    const requirements = calculateRequirementCoverage([], [test({ requirements: ["JIRA-9"] })]);
    const summary = buildSummary([test({})], [], requirements, [
      { id: "s1", tool: "codeql", title: "Finding", severity: "medium", tags: [] }
    ]);
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: {
        requirements: { failOnExtra: true },
        security: { maxMedium: 0 },
        warnings: { maxWarnings: 0 }
      }
    });
    const result = evaluateQualityGate(config, summary, 1);
    expect(
      result.checks.some((check) => check.id === "requirements.extra" && check.status === "failed")
    ).toBe(true);
    expect(
      result.checks.some((check) => check.id === "security.medium" && check.status === "failed")
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
});
