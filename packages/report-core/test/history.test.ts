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

  it("uses workflow run attempts while preserving explicit execution IDs", () => {
    const first = report("placeholder", "2026-01-01T00:00:00.000Z", []);
    delete first.metadata.runId;
    first.metadata.workflowRun = "123";
    first.metadata.workflowAttempt = 1;
    expect(deriveCurrentRunSummary(first)?.id).toBe("github-123-1");
    first.metadata.workflowAttempt = 2;
    expect(deriveCurrentRunSummary(first)?.id).toBe("github-123-2");
    first.metadata.runId = "explicit-run";
    expect(deriveCurrentRunSummary(first)?.id).toBe("explicit-run");
  });

  it("marks a previously present case as removed without recovering it", () => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [
        { testCaseId: "TC-1", status: "failed" }
      ]),
      report("two", "2026-01-02T00:00:00.000Z", [
        { testCaseId: "TC-2", status: "passed" }
      ])
    ]);
    const item = deriveCaseHistory(store).find((candidate) => candidate.testCaseId === "TC-1");
    expect(item).toMatchObject({
      transition: "removed-or-missing",
      previousStatus: "failed",
      samples: [{ presence: "present" }, { presence: "absent" }]
    });
    expect(item?.currentStatus).toBeUndefined();
  });

  it("distinguishes explicit not-run and deterministic reappearance", () => {
    const store = merged([
      report("one", "2026-01-01T00:00:00.000Z", [
        { testCaseId: "TC-1", status: "failed" }
      ]),
      report("two", "2026-01-02T00:00:00.000Z", []),
      report("three", "2026-01-03T00:00:00.000Z", [
        { testCaseId: "TC-1", status: "passed" },
        { testCaseId: "TC-2", status: "not-run" }
      ])
    ]);
    expect(
      deriveCaseHistory(store).find((candidate) => candidate.testCaseId === "TC-1")
    ).toMatchObject({ transition: "recovered", currentStatus: "passed" });
    expect(
      deriveCaseHistory(store).find((candidate) => candidate.testCaseId === "TC-2")
    ).toMatchObject({ transition: "not-executed", currentStatus: "not-run" });
  });

  it("rejects another project and permits a display-name enrichment", () => {
    const first = report("one", "2026-01-01T00:00:00.000Z", []);
    const store = mergeProjectHistory(undefined, first);
    const renamed = report("two", "2026-01-02T00:00:00.000Z", []);
    renamed.metadata.projectName = "Renamed Demo";
    expect(mergeProjectHistory(store, renamed).project.name).toBe("Renamed Demo");
    const foreign = report("foreign", "2026-01-03T00:00:00.000Z", []);
    foreign.metadata.projectKey = "OTHER";
    expect(() => mergeProjectHistory(store, foreign)).toThrow(/project mismatch/i);
    const inconsistentRun = structuredClone(store);
    inconsistentRun.runs[0]!.projectKey = "OTHER";
    expect(() => mergeProjectHistory(inconsistentRun, renamed)).toThrow(/belongs to OTHER/i);
    const inconsistentManual = structuredClone(store);
    inconsistentManual.manualExecutions.push({
      executionId: "foreign-manual",
      projectKey: "OTHER",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T01:00:00.000Z",
      status: "passed",
      caseResults: []
    });
    expect(() => mergeProjectHistory(inconsistentManual, renamed)).toThrow(
      /manual execution.*belongs to OTHER/i
    );
  });

  it("rejects unsafe historical source URLs", () => {
    const input = report("one", "2026-01-01T00:00:00.000Z", []);
    expect(() => deriveCurrentRunSummary(input, "javascript:alert(1)")).toThrow();
    expect(deriveCurrentRunSummary(input, "https://example.test/report")?.sourceReport?.url).toBe(
      "https://example.test/report"
    );
  });

  it("derives a bounded 5,000-case, 50-run, 200-manual fixture", () => {
    const caseIds = Array.from({ length: 5_000 }, (_, index) => `CASE-${index}`);
    const runs = Array.from({ length: 50 }, (_, runIndex) => ({
      id: `scale-${runIndex}`,
      type: "automated" as const,
      projectKey: "SCALE",
      reportedAt: `2026-01-${String((runIndex % 28) + 1).padStart(2, "0")}T${String(
        Math.floor(runIndex / 28)
      ).padStart(2, "0")}:00:00.000Z`,
      status: "passed" as const,
      counts: {
        total: caseIds.length,
        passed: caseIds.length,
        failed: 0,
        broken: 0,
        blocked: 0,
        skipped: 0,
        notRun: 0,
        unknown: 0
      },
      caseResults: caseIds.map((testCaseId) => ({
        testCaseId,
        status: "passed" as const,
        identity: { source: "explicit", stable: true, conflict: false }
      }))
    })).reverse();
    const manualExecutions = Array.from({ length: 200 }, (_, index) => ({
      executionId: `manual-${index}`,
      projectKey: "SCALE",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T01:00:00.000Z",
      status: "passed" as const,
      caseResults: [{ testCaseId: caseIds[index % caseIds.length]!, status: "passed" as const }]
    }));
    const store: ProjectHistoryStore = {
      schemaVersion: "1.0",
      project: { key: "SCALE", name: "Scale" },
      generatedAt: "2026-02-01T00:00:00.000Z",
      retention: {
        maxRuns: 50,
        maxAgeDays: 180,
        maxManualExecutions: 200,
        prunedRuns: 0,
        prunedManualExecutions: 0
      },
      runs,
      manualExecutions,
      diagnostics: []
    };
    const artifact = deriveHistoryArtifact(store);
    expect(artifact.runs).toHaveLength(50);
    expect(artifact.manualExecutions).toHaveLength(200);
    expect(artifact.cases).toHaveLength(5_000);
    expect(new Set(artifact.manualExecutions.map((item) => item.executionId)).size).toBe(200);
    expect(JSON.stringify(artifact).length).toBeLessThan(100_000_000);
  });
});
