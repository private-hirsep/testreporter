import type { Manifest, TestCase } from "../types";

/** Test-only factory for a complete, internally consistent manifest. */
export function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  const base: Manifest = {
    schemaVersion: "1.0",
    metadata: {
      projectName: "RFL Tool",
      repository: "org/rfl-tool",
      generatedAt: "2026-07-23T10:15:00.000Z",
      branch: "main",
      commitSha: "8f91c2a4d21b9e77",
      runId: "1842",
      release: "1.1.7",
      testedBuild: "build-117",
      environment: "staging",
      workflowRun: "#1842"
    },
    summary: {
      tests: { total: 10, passed: 7, failed: 2, broken: 0, skipped: 1, unknown: 0, byLayer: {} },
      coverage: { totalPercentage: 81.2 },
      security: { high: 1, medium: 2 },
      requirements: emptyRequirements()
    },
    requirements: {
      ...emptyRequirements(),
      expected: ["REQ-1", "REQ-2", "REQ-3"],
      covered: ["REQ-1", "REQ-2"],
      missing: ["REQ-3"],
      extra: ["REQ-9"],
      percentage: 66.7
    },
    coverage: [],
    security: [],
    qualityGate: { status: "passed", profile: "standard", checks: [] },
    downloads: [],
    history: { runs: [] },
    warnings: [],
    chunks: { tests: [] },
    manualCases: [],
    manualExecutions: [],
    readiness: {
      status: "blocked",
      reasons: ["Test abc123 failed."],
      automated: { passed: 7, failed: 2, skipped: 1, missing: false },
      manual: { passed: 1, failed: 1, blocked: 0, notRun: 1 },
      requirements: {
        covered: 1,
        uncovered: 1,
        excluded: 0,
        uncoveredIds: ["REQ-3"],
        excludedIds: []
      },
      securityBlockers: 1,
      qualityGateFailed: false,
      acceptedRisks: [{ id: "RISK-1", reason: "accepted", reference: "TICKET-9" }],
      missingEvidence: [],
      actions: [
        {
          severity: "blocker",
          type: "failed-test",
          project: "RFL",
          reference: "abc123",
          message: "Test abc123 failed.",
          href: "#/tests/abc123"
        },
        {
          severity: "warning",
          type: "manual-case",
          project: "RFL",
          reference: "MT-1",
          message: "Required manual case MT-1 is not-run."
        }
      ]
    }
  };
  return { ...base, ...overrides };
}

export function makeTest(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "abc123",
    name: "rejects duplicate email",
    fullName: "UserServiceTest > rejects duplicate email",
    framework: "junit",
    layer: "backend",
    status: "failed",
    retries: 0,
    requirements: ["REQ-1"],
    ...overrides
  };
}

function emptyRequirements() {
  return {
    expected: [],
    covered: [],
    missing: [],
    extra: [],
    percentage: 100,
    testsByRequirement: {}
  };
}
