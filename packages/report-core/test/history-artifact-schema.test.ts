import { describe, expect, it } from "vitest";

import {
  HistoricalSampleSchema,
  OptimizedHistoryArtifactSchema,
  parseOptimizedHistoryArtifact
} from "../src/history/artifact-schema.js";

function artifact() {
  return {
    schemaVersion: "1.0" as const,
    project: { key: "DEMO", name: "Demo" },
    generatedAt: "2026-07-24T00:00:00.000Z",
    retention: {
      maxRuns: 50,
      maxAgeDays: 180,
      maxManualExecutions: 200,
      prunedRuns: 0,
      prunedManualExecutions: 0
    },
    availability: "available" as const,
    runs: [
      {
        id: "run-1",
        type: "automated" as const,
        projectKey: "DEMO",
        release: "1.0",
        branch: "main",
        environment: "ci",
        commit: "abc123",
        workflowRun: "123",
        workflowAttempt: 2,
        reportedAt: "2026-07-24T00:00:00.000Z",
        startedAt: "2026-07-23T23:59:00.000Z",
        completedAt: "2026-07-24T00:00:00.000Z",
        wallClockDurationMs: 60_000,
        testDurationSumMs: 100,
        status: "passed" as const,
        counts: {
          total: 1,
          passed: 1,
          failed: 0,
          broken: 0,
          blocked: 0,
          skipped: 0,
          notRun: 0,
          unknown: 0
        },
        qualityGate: { status: "passed" as const, profile: "default" },
        readiness: {
          status: "ready" as const,
          blockers: 0,
          warnings: 0,
          acceptedRisks: 0
        },
        requirements: { covered: 1, uncovered: 0, excluded: 0, total: 1 },
        coverage: { line: 92 },
        security: { blockers: 0, warnings: 1, accepted: 0 },
        caseResults: [
          {
            testCaseId: "CASE-1",
            implementationId: "chrome",
            status: "passed" as const,
            durationMs: 100,
            identity: { source: "explicit", stable: true, conflict: false }
          }
        ],
        sourceReport: { url: "https://example.test/report" }
      }
    ],
    manualExecutions: [],
    cases: [
      {
        testCaseId: "CASE-1",
        streams: [
          {
            key: "automated\u0000main\u0000ci",
            type: "automated" as const,
            branch: "main",
            environment: "ci",
            samples: [
              {
                executionId: "run-1",
                type: "automated" as const,
                at: "2026-07-24T00:00:00.000Z",
                status: "passed" as const,
                presence: "present" as const,
                durationMs: 100
              }
            ],
            currentStatus: "passed" as const,
            transition: "new-case" as const,
            sampleSize: 1,
            passed: 1,
            failed: 0,
            consecutiveFailures: 0,
            stability: "insufficient-history" as const,
            passFailTransitions: 0
          }
        ],
        aggregateCurrentStatus: "passed" as const,
        currentStatus: "passed" as const,
        transition: "new-case" as const,
        sampleSize: 1,
        passed: 1,
        failed: 0,
        consecutiveFailures: 0,
        identityConfidence: "trusted" as const,
        stability: "insufficient-history" as const,
        passFailTransitions: 0
      }
    ],
    trends: {
      runCount: 1,
      oldestAt: "2026-07-24T00:00:00.000Z",
      newestAt: "2026-07-24T00:00:00.000Z",
      newFailures: 0,
      persistentFailures: 0,
      recovered: 0,
      removedOrMissing: 0,
      unstable: 0,
      slowRegressions: 0
    },
    diagnostics: [
      {
        id: "diagnostic-1",
        severity: "information" as const,
        code: "HISTORY_OK",
        message: "History is available.",
        projectKey: "DEMO"
      }
    ]
  };
}

describe("optimized history artifact schema", () => {
  it("round-trips every supported run metadata field without stripping", () => {
    const parsed = parseOptimizedHistoryArtifact(
      JSON.parse(JSON.stringify(artifact())) as unknown
    );
    expect(parsed.runs[0]).toMatchObject({
      requirements: { covered: 1 },
      coverage: { line: 92 },
      security: { warnings: 1 },
      readiness: { status: "ready" },
      qualityGate: { status: "passed" },
      workflowAttempt: 2,
      branch: "main",
      environment: "ci",
      release: "1.0",
      commit: "abc123"
    });
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(artifact());
  });

  it.each([
    ["result status", (value: ReturnType<typeof artifact>) => (value.runs[0]!.caseResults[0]!.status = "banana" as never)],
    ["transition", (value: ReturnType<typeof artifact>) => (value.cases[0]!.transition = "banana" as never)],
    ["stability", (value: ReturnType<typeof artifact>) => (value.cases[0]!.stability = "totally-stable" as never)],
    ["identity confidence", (value: ReturnType<typeof artifact>) => (value.cases[0]!.identityConfidence = "maybe" as never)]
  ])("rejects invalid %s", (_label, mutate) => {
    const value = artifact();
    mutate(value);
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["run ID", (value: ReturnType<typeof artifact>) => value.runs.push(structuredClone(value.runs[0]!))],
    ["case ID", (value: ReturnType<typeof artifact>) => value.cases.push(structuredClone(value.cases[0]!))],
    ["stream key", (value: ReturnType<typeof artifact>) => value.cases[0]!.streams.push(structuredClone(value.cases[0]!.streams[0]!))],
    ["sample execution ID", (value: ReturnType<typeof artifact>) => value.cases[0]!.streams[0]!.samples.push(structuredClone(value.cases[0]!.streams[0]!.samples[0]!))],
    ["diagnostic ID", (value: ReturnType<typeof artifact>) => value.diagnostics.push(structuredClone(value.diagnostics[0]!))]
  ])("rejects duplicate %s", (_label, mutate) => {
    const value = artifact();
    mutate(value);
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it("allows browser variants under one execution and rejects duplicate implementation IDs", () => {
    const valid = artifact();
    valid.runs[0]!.caseResults.push({
      ...structuredClone(valid.runs[0]!.caseResults[0]!),
      implementationId: "firefox"
    });
    valid.runs[0]!.counts = { ...valid.runs[0]!.counts, total: 2, passed: 2 };
    expect(OptimizedHistoryArtifactSchema.safeParse(valid).success).toBe(true);
    valid.runs[0]!.caseResults[1]!.implementationId = "chrome";
    expect(OptimizedHistoryArtifactSchema.safeParse(valid).success).toBe(false);
  });

  it("rejects duplicate result snapshots without distinct implementation identities", () => {
    const value = artifact();
    delete value.runs[0]!.caseResults[0]!.implementationId;
    value.runs[0]!.caseResults.push(structuredClone(value.runs[0]!.caseResults[0]!));
    value.runs[0]!.counts = { ...value.runs[0]!.counts, total: 2, passed: 2 };
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["sample size", "sampleSize", 2],
    ["passed count", "passed", 0],
    ["failed count", "failed", 1],
    ["pass rate", "passRate", 42],
    ["consecutive failures", "consecutiveFailures", 2]
  ] as const)("rejects inconsistent stream %s", (_label, field, replacement) => {
    const value = artifact();
    Object.assign(value.cases[0]!.streams[0]!, { [field]: replacement });
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it("rejects trend counts inconsistent with retained runs and logical cases", () => {
    const runCount = artifact();
    runCount.trends.runCount = 2;
    expect(OptimizedHistoryArtifactSchema.safeParse(runCount).success).toBe(false);
    const excessiveMetric = artifact();
    excessiveMetric.trends.newFailures = 2;
    expect(OptimizedHistoryArtifactSchema.safeParse(excessiveMetric).success).toBe(false);
  });

  it("rejects legacy case fields that disagree with the preferred stream", () => {
    const value = artifact();
    value.cases[0]!.currentStatus = "failed";
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it("does not expose trusted stability for an identity-conflicted case", () => {
    const value = artifact();
    value.cases[0]!.identityConfidence = "conflicted";
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["negative", { total: 0, passed: -1, failed: 0, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 0 }],
    ["fractional", { total: 1, passed: 0.5, failed: 0.5, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 0 }],
    ["sum low", { total: 2, passed: 1, failed: 0, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 0 }],
    ["sum high", { total: 1, passed: 1, failed: 1, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 0 }]
  ])("rejects %s counts", (_label, counts) => {
    const value = artifact();
    value.runs[0]!.counts = counts;
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it("accepts a zero-test run and includes unknown in the total", () => {
    const value = artifact();
    value.runs[0]!.counts = { total: 1, passed: 0, failed: 0, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 1 };
    value.runs[0]!.caseResults = [];
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
    value.runs[0]!.counts = { total: 0, passed: 0, failed: 0, broken: 0, blocked: 0, skipped: 0, notRun: 0, unknown: 0 };
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["absent with passed status", { presence: "absent", status: "passed" }],
    ["present with absent status", { presence: "present", status: "absent" }],
    ["absent with duration", { presence: "absent", status: "absent", durationMs: 1 }],
    ["absent with results", { presence: "absent", status: "absent", implementationResults: [] }]
  ])("rejects %s", (_label, replacement) => {
    const value = artifact();
    Object.assign(value.cases[0]!.streams[0]!.samples[0]!, replacement);
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });

  it("accepts explicit not-run and a valid absence marker", () => {
    const notRun = {
      ...artifact().cases[0]!.streams[0]!.samples[0]!,
      presence: "present",
      status: "not-run"
    } as const;
    expect(HistoricalSampleSchema.safeParse(notRun).success).toBe(true);
    const absent = {
      ...artifact().cases[0]!.streams[0]!.samples[0]!,
      presence: "absent",
      status: "absent"
    } as const;
    delete (absent as { durationMs?: number }).durationMs;
    expect(HistoricalSampleSchema.safeParse(absent).success).toBe(true);
  });

  it.each([
    ["invalid timestamp", (value: ReturnType<typeof artifact>) => (value.generatedAt = "yesterday")],
    ["completion before start", (value: ReturnType<typeof artifact>) => (value.runs[0]!.completedAt = "2026-07-23T00:00:00.000Z")],
    ["negative duration", (value: ReturnType<typeof artifact>) => (value.runs[0]!.wallClockDurationMs = -1)],
    ["infinite duration", (value: ReturnType<typeof artifact>) => (value.runs[0]!.testDurationSumMs = Number.POSITIVE_INFINITY)]
  ])("rejects %s", (_label, mutate) => {
    const value = artifact();
    mutate(value);
    expect(OptimizedHistoryArtifactSchema.safeParse(value).success).toBe(false);
  });
});
