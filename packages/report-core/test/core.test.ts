import { describe, expect, it } from "vitest";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  extractRequirementKeys,
  QualityReportConfigSchema,
  testIdentity,
  type NormalizedTestCase,
  type SecurityFinding,
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
  it("deduplicates retries by stable identity and keeps latest final status", () => {
    const result = deduplicateTests([
      test({
        status: "failed",
        durationMs: 10,
        requirements: ["RFL-1"],
        attachments: [{ name: "trace", path: "trace.zip" }]
      }),
      test({ status: "passed", durationMs: 12, requirements: ["RFL-2"] })
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("passed");
    expect(result[0]?.retries).toBe(1);
    expect(result[0]?.requirements).toEqual(["RFL-1", "RFL-2"]);
    expect(result[0]?.attachments).toHaveLength(1);
    expect(result[0]?.id).toBe(testIdentity(result[0]!));
  });

  it("extracts and calculates requirement coverage deterministically", () => {
    expect(extractRequirementKeys("RFL-2 RFL-1 RFL-2", /RFL-[0-9]+/g)).toEqual(["RFL-2", "RFL-1"]);
    const result = calculateRequirementCoverage(
      ["RFL-2", "RFL-1", "RFL-1", "RFL-3"],
      [
        test({ id: "a", requirements: ["RFL-1", "RFL-2"] }),
        test({ id: "b", name: "other", requirements: ["RFL-2", "RFL-99"] })
      ]
    );
    expect(result.expected).toEqual(["RFL-1", "RFL-2", "RFL-3"]);
    expect(result.covered).toEqual(["RFL-1", "RFL-2"]);
    expect(result.missing).toEqual(["RFL-3"]);
    expect(result.extra).toEqual(["RFL-99"]);
    expect(result.percentage).toBe(66.67);
    expect(result.testsByRequirement["RFL-2"]).toEqual(["a", "b"]);
  });

  it("evaluates default strict failed, broken, and security quality gates", () => {
    const requirements = calculateRequirementCoverage(["RFL-1"], [test({})]);
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
        requirements: { failOnMissing: false },
        security: { maxCritical: 0, maxHigh: 0 }
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

  it("evaluates coverage and requirement thresholds", () => {
    const summary = buildSummary(
      [test({})],
      [
        {
          layer: "backend",
          lines: { covered: 8, missed: 2, total: 10, percentage: 80 },
          files: [],
          rawLinks: []
        },
        {
          layer: "frontend",
          lines: { covered: 6, missed: 4, total: 10, percentage: 60 },
          files: [],
          rawLinks: []
        }
      ],
      calculateRequirementCoverage(["RFL-1", "RFL-2"], [test({})]),
      []
    );
    const config = QualityReportConfigSchema.parse({
      project: { name: "x" },
      qualityGates: {
        coverage: { totalMinimum: 75, backendMinimum: 80, frontendMinimum: 70 },
        requirements: { minimum: 75, failOnMissing: true }
      }
    });
    const result = evaluateQualityGate(config, summary);
    expect(result.status).toBe("failed");
    expect(result.checks.find((check) => check.id === "coverage.total")?.status).toBe("failed");
    expect(result.checks.find((check) => check.id === "coverage.backend")?.status).toBe("passed");
    expect(result.checks.find((check) => check.id === "coverage.frontend")?.status).toBe("failed");
    expect(result.checks.find((check) => check.id === "requirements.minimum")?.status).toBe(
      "failed"
    );
    expect(result.checks.find((check) => check.id === "requirements.missing")?.status).toBe(
      "failed"
    );
  });

  it("validates custom requirement regex configuration", () => {
    expect(
      QualityReportConfigSchema.parse({
        project: { name: "x" },
        requirements: { keyPattern: "REQ-\\d+" }
      }).requirements.keyPattern
    ).toBe("REQ-\\d+");
    expect(() =>
      QualityReportConfigSchema.parse({ project: { name: "x" }, requirements: { keyPattern: "[" } })
    ).toThrow(/valid regular expression/);
  });
});
