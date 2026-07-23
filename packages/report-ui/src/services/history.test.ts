import { describe, expect, it } from "vitest";

import { makeManifest } from "./fixtures";
import { allExecutions, safeHistoricalUrl } from "./history";
import { validateHistoryArtifact } from "./reportData";
import type { HistoryArtifact } from "../types";

function history(): HistoryArtifact {
  return {
    schemaVersion: "1.0",
    project: { key: "DEMO", name: "Demo" },
    generatedAt: "2026-01-02T00:00:00.000Z",
    retention: {
      maxRuns: 50,
      maxAgeDays: 180,
      maxManualExecutions: 200,
      prunedRuns: 0,
      prunedManualExecutions: 0
    },
    availability: "available",
    runs: [],
    manualExecutions: [],
    cases: [],
    trends: {
      runCount: 2,
      newFailures: 0,
      persistentFailures: 0,
      recovered: 0,
      removedOrMissing: 0,
      unstable: 0,
      slowRegressions: 0
    },
    diagnostics: []
  };
}

describe("history UI data", () => {
  it("uses one deduplicated execution source for current and historical details", () => {
    const manifest = makeManifest();
    manifest.unifiedExecutions = [
      {
        id: "current",
        type: "automated",
        project: "DEMO",
        status: "passed",
        counts: { total: 1, passed: 1, failed: 0 },
        testCaseIds: ["TC-1"],
        caseResults: [{ testCaseId: "TC-1", status: "passed" }],
        requirementIds: [],
        defectIds: []
      }
    ];
    const artifact = history();
    artifact.runs.push(
      {
        id: "current",
        type: "automated",
        projectKey: "DEMO",
        reportedAt: "2026-01-02T00:00:00.000Z",
        status: "failed",
        counts: {
          total: 1,
          passed: 0,
          failed: 1,
          broken: 0,
          blocked: 0,
          skipped: 0,
          notRun: 0,
          unknown: 0
        },
        caseResults: []
      },
      {
        id: "historical",
        type: "automated",
        projectKey: "DEMO",
        workflowAttempt: 2,
        reportedAt: "2026-01-01T00:00:00.000Z",
        status: "failed",
        counts: {
          total: 1,
          passed: 0,
          failed: 1,
          broken: 0,
          blocked: 0,
          skipped: 0,
          notRun: 0,
          unknown: 0
        },
        caseResults: []
      }
    );
    artifact.manualExecutions.push({
      executionId: "manual-old",
      projectKey: "DEMO",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T01:00:00.000Z",
      status: "passed",
      caseResults: []
    });
    const executions = allExecutions(manifest, artifact);
    expect(executions.map((item) => item.id)).toEqual([
      "current",
      "historical",
      "manual-old"
    ]);
    expect(executions[0]!.status).toBe("passed");
  });

  it("validates optional history independently", () => {
    expect(() => validateHistoryArtifact({ schemaVersion: "2.0" })).toThrow(
      /unsupported/i
    );
    expect(() => validateHistoryArtifact({ schemaVersion: "1.0" })).toThrow(
      /contract/i
    );
    expect(validateHistoryArtifact(history()).project.key).toBe("DEMO");
  });

  it("does not expose unsafe historical links", () => {
    expect(safeHistoricalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHistoricalUrl("https://example.test/report")).toBe(
      "https://example.test/report"
    );
  });
});
