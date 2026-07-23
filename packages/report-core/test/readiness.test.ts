import { describe, expect, it } from "vitest";
import {
  determineReadiness,
  ProjectQualitySummarySchema,
  ReleaseScopeSchema,
  sortPortfolio,
  validateReleaseScopeReferences
} from "../src/index.js";

const scope = ReleaseScopeSchema.parse({
  release: "2.0",
  requirements: ["REQ-1", "REQ-2", "REQ-3"],
  requiredManualCases: ["CASE-1"],
  excludedRequirements: [{ id: "REQ-3", reason: "Deferred" }]
});

describe("release readiness", () => {
  it("validates scope and unknown IDs", () => {
    expect(
      ReleaseScopeSchema.safeParse({
        release: "2",
        excludedRequirements: [{ id: "REQ-2" }]
      }).success
    ).toBe(false);
    expect(validateReleaseScopeReferences(scope, [], []).map((item) => item.code)).toEqual([
      "release-scope.unknown-requirement",
      "release-scope.unknown-requirement",
      "release-scope.unknown-requirement",
      "release-scope.unknown-manual-case"
    ]);
  });

  it("reports covered, uncovered, and excluded requirement counts separately", () => {
    const value = determineReadiness({
      project: "P",
      scope,
      reportRelease: "2.0",
      tests: [{ id: "T-1", status: "passed" }],
      manualStatuses: { "CASE-1": "passed" },
      coveredRequirements: ["REQ-1"],
      security: [],
      qualityGateStatus: "passed"
    });
    expect(value.requirements).toEqual({
      covered: 1,
      uncovered: 1,
      excluded: 1,
      uncoveredIds: ["REQ-2"],
      excludedIds: ["REQ-3"]
    });
  });

  it("creates explicit quality-gate blocker actions and reasons", () => {
    const value = determineReadiness({
      project: "P",
      scope,
      reportRelease: "2.0",
      tests: [{ id: "T-1", status: "passed" }],
      manualStatuses: { "CASE-1": "passed" },
      coveredRequirements: ["REQ-1", "REQ-2"],
      security: [],
      qualityGateStatus: "failed",
      qualityGateFailures: [
        { id: "coverage.total", label: "Total coverage", message: "65% is below 80%" }
      ]
    });
    expect(value.status).toBe("blocked");
    expect(value.actions).toContainEqual({
      severity: "blocker",
      type: "quality-gate-failed",
      project: "P",
      reference: "coverage.total",
      message: "Total coverage failed: 65% is below 80%"
    });
    expect(value.reasons).toContain("Total coverage failed: 65% is below 80%");
  });

  it("blocks when release scope and report release differ", () => {
    const value = determineReadiness({
      project: "P",
      scope,
      reportRelease: "2.1",
      tests: [{ id: "T-1", status: "passed" }],
      manualStatuses: { "CASE-1": "passed" },
      coveredRequirements: ["REQ-1", "REQ-2"],
      security: [],
      qualityGateStatus: "passed"
    });
    expect(value.actions).toContainEqual({
      severity: "blocker",
      type: "release-scope-mismatch",
      project: "P",
      reference: "2.0",
      message: "Release scope 2.0 does not match report release 2.1."
    });
  });

  it("does not hide failures accepted as risks", () => {
    const value = determineReadiness({
      project: "P",
      scope: { ...scope, acceptedRisks: [{ id: "RISK-1", reason: "documented" }] },
      tests: [{ id: "T-1", status: "failed" }],
      manualStatuses: { "CASE-1": "passed" },
      coveredRequirements: ["REQ-1", "REQ-2"],
      security: [],
      qualityGateStatus: "passed"
    });
    expect(value.actions.map((item) => item.type)).toEqual(["failed-test", "accepted-risk"]);
    expect(value.status).toBe("blocked");
  });

  it("supports older reports by treating absent scope as incomplete", () => {
    expect(
      determineReadiness({
        project: "P",
        tests: [],
        manualStatuses: {},
        coveredRequirements: [],
        security: [],
        qualityGateStatus: "not_evaluated"
      }).status
    ).toBe("incomplete");
  });
});

describe("portfolio", () => {
  const base = {
    schemaVersion: "1.0" as const,
    release: "1",
    generatedAt: "2026-07-14T00:00:00.000Z",
    qualityGate: "passed" as const,
    readiness: "ready" as const,
    passedTests: 1,
    failedTests: 0,
    newFailures: 0,
    manualRemaining: 0,
    uncoveredRequirements: 0,
    securityBlockers: 0,
    acceptedRisks: 0,
    recommendedActions: 0
  };

  it("sorts blockers, stale, work, and healthy projects", () => {
    const result = sortPortfolio(
      [
        { ...base, projectKey: "H", projectName: "Healthy" },
        { ...base, projectKey: "M", projectName: "Manual", manualRemaining: 1 },
        { ...base, projectKey: "B", projectName: "Blocked", readiness: "blocked" }
      ],
      new Date("2026-07-15T00:00:00Z")
    );
    expect(result.map((item) => item.projectKey)).toEqual(["B", "M", "H"]);
    expect(
      sortPortfolio(
        [{ ...base, projectKey: "S", projectName: "Stale", generatedAt: "2020-01-01T00:00:00Z" }],
        new Date("2026-07-15T00:00:00Z")
      )[0]
    ).toMatchObject({ stale: true, priority: 2 });
  });

  it("accepts only HTTP(S) report links", () => {
    expect(
      ProjectQualitySummarySchema.safeParse({
        ...base,
        projectKey: "P",
        projectName: "Project",
        reportUrl: "https://example.invalid/report"
      }).success
    ).toBe(true);
    expect(
      ProjectQualitySummarySchema.safeParse({
        ...base,
        projectKey: "P",
        projectName: "Project",
        reportUrl: "ftp://example.invalid/report"
      }).success
    ).toBe(false);
  });
});
