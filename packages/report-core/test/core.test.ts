import { describe, expect, it } from "vitest";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  QualityReportConfigSchema,
  type NormalizedTestCase,
  type QualityReportConfig
} from "../src/index.js";

function test(overrides: Partial<NormalizedTestCase>): NormalizedTestCase {
  return {
    id: overrides.id ?? "id",
    name: overrides.name ?? "test RFL-1",
    framework: "junit",
    layer: "backend",
    status: "passed",
    retries: 0,
    requirements: ["RFL-1"],
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
    const result = calculateRequirementCoverage(["RFL-1", "RFL-2"], [test({})]);
    expect(result.percentage).toBe(50);
    expect(result.missing).toEqual(["RFL-2"]);
  });

  it("evaluates quality gates", () => {
    const requirements = calculateRequirementCoverage(["RFL-1"], [test({})]);
    const summary = buildSummary([test({ status: "failed" })], [], requirements, []);
    const config = {
      project: { name: "x" },
      artifacts: {},
      requirements: { keyPattern: "[A-Z]+-[0-9]+" },
      qualityGates: {
        tests: { allowFailed: 0, allowBroken: 0 },
        coverage: {},
        requirements: { failOnMissing: false },
        security: { maxCritical: 0, maxHigh: 0 }
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
    const requirements = calculateRequirementCoverage(["RFL-1"], [test({})]);
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
