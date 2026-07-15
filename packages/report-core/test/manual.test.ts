import { describe, expect, it } from "vitest";
import {
  calculateManualCaseStatus,
  ManualCaseSchema,
  ManualExecutionSchema,
  QualityReportConfigSchema,
  evaluateQualityGate
} from "../src/index.js";

describe("manual testing model", () => {
  it("validates definitions and calculates step outcomes", () => {
    expect(
      ManualCaseSchema.parse({
        id: "APP-MT-1",
        title: "Check",
        steps: [{ action: "Act", expected: "Observe" }]
      }).status
    ).toBe("draft");
    expect(calculateManualCaseStatus([{ status: "passed" }, { status: "skipped" }])).toBe("passed");
    expect(calculateManualCaseStatus([{ status: "passed" }, { status: "failed" }])).toBe("failed");
  });
  it("rejects invalid completed results and duplicate case IDs", () => {
    expect(() =>
      ManualExecutionSchema.parse({
        schemaVersion: "1.0",
        executionId: "run",
        projectKey: "APP",
        testedBuild: "build",
        environment: "test",
        tester: "tester",
        startedAt: "2026-01-01T00:00:00.000Z",
        state: "completed",
        cases: [
          { caseId: "APP-MT-1", status: "not-run", steps: [], defects: [], evidence: [] },
          { caseId: "APP-MT-1", status: "passed", steps: [], defects: [], evidence: [] }
        ]
      })
    ).toThrow();
  });
  it("keeps manual gates opt-in", () => {
    const config = QualityReportConfigSchema.parse({ project: { name: "APP" } });
    const summary = {
      tests: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0, byLayer: {} },
      coverage: {},
      security: {},
      requirements: {
        expected: [],
        covered: [],
        missing: [],
        extra: [],
        percentage: 100,
        testsByRequirement: {}
      },
      manual: {
        cases: 1,
        executed: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        notRun: 1,
        completionPercentage: 0,
        missingEvidence: 0
      }
    };
    expect(
      evaluateQualityGate(config, summary).checks.some((check) => check.id.startsWith("manual."))
    ).toBe(false);
  });
});
