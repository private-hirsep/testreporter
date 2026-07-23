import { describe, expect, it } from "vitest";

import {
  deriveCaseHistory,
  deriveCurrentRunSummary,
  deriveHistoryArtifact,
  emptyHistoryStore,
  mergeProjectHistory,
  type NormalizedReport,
  type ProjectHistoryStore
} from "../src/index.js";

function report(
  id: string,
  at: string,
  results: Array<{
    testCaseId: string;
    implementationId?: string;
    status: "passed" | "failed" | "broken" | "blocked" | "not-run" | "skipped" | "unknown";
    durationMs?: number;
    source?: "explicit" | "generated";
    conflict?: boolean;
  }>,
  branch = "main",
  environment = "ci"
): NormalizedReport {
  const counts = {
    total: results.length,
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status === "failed").length,
    broken: results.filter((item) => item.status === "broken").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    unknown: results.filter((item) => item.status === "unknown").length
  };
  return {
    schemaVersion: "1.0",
    metadata: {
      projectKey: "DEMO",
      projectName: "Demo",
      generatedAt: at,
      runId: id,
      branch,
      environment
    },
    summary: {
      tests: { ...counts, byLayer: {} },
      coverage: {},
      security: {},
      requirements: {
        expected: [],
        covered: [],
        missing: [],
        extra: [],
        percentage: 100,
        testsByRequirement: {},
        manualCasesByRequirement: {},
        latestManualResultByRequirement: {},
        evidenceTypeByRequirement: {}
      },
      manual: {
        cases: 0,
        executed: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        notRun: 0,
        completionPercentage: 100,
        missingEvidence: 0
      }
    },
    tests: [],
    coverage: [],
    requirements: {
      expected: [],
      covered: [],
      missing: [],
      extra: [],
      percentage: 100,
      testsByRequirement: {},
      manualCasesByRequirement: {},
      latestManualResultByRequirement: {},
      evidenceTypeByRequirement: {}
    },
    security: [],
    qualityGate: { status: counts.failed || counts.broken ? "failed" : "passed", enabled: true, checks: [] },
    downloads: [],
    history: { runs: [] },
    warnings: [],
    manualCases: [],
    manualExecutions: [],
    identityDiagnostics: {
      total: results.length,
      explicit: results.length,
      titleToken: 0,
      mapping: 0,
      generated: 0,
      duplicateCanonicalIds: [],
      duplicateExplicitIds: [],
      multiImplementationCanonicalIds: [],
      conflictingCanonicalIds: [],
      malformedExplicitIds: 0,
      ambiguousMappings: 0
    },
    testCaseCatalogue: results.map((item) => ({
      id: item.testCaseId,
      canonicalId: item.testCaseId,
      displayId: item.testCaseId,
      identity: {
        source: item.source ?? "explicit",
        stable: item.source !== "generated",
        conflict: item.conflict ?? false
      },
      title: item.testCaseId,
      type: "automated",
      requirements: [],
      defects: [],
      tags: [],
      implementations: [],
      stability: {
        available: false,
        sampleSize: 1,
        passed: 0,
        failed: 0,
        flaky: 0,
        source: "insufficient-data"
      }
    })),
    unifiedExecutions: [
      {
        id,
        type: "automated",
        project: "DEMO",
        branch,
        environment,
        reportedAt: at,
        status: counts.failed || counts.broken ? "failed" : "passed",
        counts,
        testDurationSumMs: results.reduce((sum, item) => sum + (item.durationMs ?? 0), 0),
        testCaseIds: [...new Set(results.map((item) => item.testCaseId))],
        caseResults: results.map((item) => ({
          testCaseId: item.testCaseId,
          ...(item.implementationId ? { implementationId: item.implementationId } : {}),
          status: item.status,
          ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {})
        })),
        requirementIds: [],
        defectIds: []
      }
    ]
  };
}

function merged(reports: NormalizedReport[], options = {}) {
  let store: ProjectHistoryStore | undefined;
  for (const item of reports) store = mergeProjectHistory(store, item, options);
  return store!;
}

describe("project history", () => {
  it("creates an empty versioned store", () => {
    expect(emptyHistoryStore({ key: "DEMO", name: "Demo" }, "2026-01-01T00:00:00.000Z")).toMatchObject({
      schemaVersion: "1.0",
      runs: [],
      manualExecutions: []
    });
  });

  it("generates one compact deterministic run and preserves reported time", () => {
    const input = report("run-1", "2026-01-01T00:00:00.000Z", [
      { testCaseId: "TC-1", implementationId: "chrome", status: "passed", durationMs: 100 },
      { testCaseId: "TC-1", implementationId: "firefox", status: "failed", durationMs: 200 }
    ]);
    expect(deriveCurrentRunSummary(input)).toMatchObject({
      id: "run-1",
      reportedAt: "2026-01-01T00:00:00.000Z",
      testDurationSumMs: 300,
      caseResults: [{ implementationId: "chrome" }, { implementationId: "firefox" }]
    });
    expect(deriveCurrentRunSummary(input)).toEqual(deriveCurrentRunSummary(input));
  });

  it("is idempotent and diagnoses conflicting duplicate run IDs", () => {
    const first = report("run-1", "2026-01-01T00:00:00.000Z", [
      { testCaseId: "TC-1", status: "passed" }
    ]);
    const once = mergeProjectHistory(undefined, first);
    expect(mergeProjectHistory(once, first).runs).toHaveLength(1);
    const conflict = mergeProjectHistory(
      once,
      report("run-1", "2026-01-01T00:00:00.000Z", [
        { testCaseId: "TC-1", status: "failed" }
      ])
    );
    expect(conflict.runs[0]!.caseResults[0]!.status).toBe("passed");
    expect(conflict.diagnostics.some((item) => item.code === "HISTORY_RUN_CONFLICT")).toBe(true);
  });

  it("sorts and prunes deterministically while retaining the current run", () => {
    const store = merged(
      [
        report("one", "2026-01-01T00:00:00.000Z", []),
        report("two", "2026-01-02T00:00:00.000Z", []),
        report("three", "2026-01-03T00:00:00.000Z", [])
      ],
      { maxRuns: 2, maxAgeDays: 365 }
    );
    expect(store.runs.map((item) => item.id)).toEqual(["three", "two"]);
    expect(store.retention.prunedRuns).toBe(1);
  });

  it.each([
    ["newly-failing", "passed", "failed"],
    ["persistently-failing", "failed", "broken"],
    ["recovered", "failed", "passed"],
    ["newly-blocked", "passed", "blocked"],
    ["still-blocked", "blocked", "blocked"]
  ] as const)("derives %s", (expected, previous, current) => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [{ testCaseId: "TC-1", status: previous }]),
      report("two", "2026-01-02T00:00:00.000Z", [{ testCaseId: "TC-1", status: current }])
    ]);
    expect(deriveCaseHistory(store)[0]!.transition).toBe(expected);
  });

  it("does not compare branch or environment mismatches", () => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [{ testCaseId: "TC-1", status: "passed" }]),
      report("two", "2026-01-02T00:00:00.000Z", [{ testCaseId: "TC-1", status: "failed" }], "feature")
    ]);
    expect(deriveCaseHistory(store)[0]).toMatchObject({
      transition: "first-observed-failing",
      sampleSize: 1
    });
  });

  it("counts variants as one execution sample using worst state", () => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [
        { testCaseId: "TC-1", implementationId: "chrome", status: "passed" },
        { testCaseId: "TC-1", implementationId: "firefox", status: "failed" }
      ])
    ]);
    expect(deriveCaseHistory(store)[0]).toMatchObject({
      sampleSize: 1,
      currentStatus: "failed"
    });
  });

  it("uses conservative stability and identity confidence", () => {
    const reports = ["passed", "failed", "passed", "failed", "passed"].map((status, index) =>
      report(`run-${index}`, `2026-01-0${index + 1}T00:00:00.000Z`, [
        {
          testCaseId: "TC-1",
          status: status as "passed" | "failed",
          source: "generated"
        }
      ])
    );
    expect(deriveCaseHistory(merged(reports))[0]).toMatchObject({
      stability: "historically-unstable",
      identityConfidence: "generated-low",
      sampleSize: 5
    });
  });

  it("requires percentage and absolute duration thresholds", () => {
    const make = (id: string, day: number, durationMs: number) =>
      report(id, `2026-01-0${day}T00:00:00.000Z`, [
        { testCaseId: "TC-1", status: "passed", durationMs }
      ]);
    expect(
      deriveCaseHistory(merged([make("one", 1, 1000), make("two", 2, 1100), make("three", 3, 1400)]))[0]!
        .duration?.slowRegression
    ).toBe(false);
    expect(
      deriveCaseHistory(merged([make("one", 1, 1000), make("two", 2, 1000), make("three", 3, 1600)]))[0]!
        .duration?.slowRegression
    ).toBe(true);
  });

  it("emits bounded static trends and insufficient state", () => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [{ testCaseId: "TC-1", status: "passed" }])
    ]);
    expect(deriveHistoryArtifact(store)).toMatchObject({
      availability: "insufficient",
      trends: { runCount: 1 }
    });
  });
});
