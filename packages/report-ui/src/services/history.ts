import type { HistoryArtifact, Manifest, UnifiedExecution } from "../types";

export function historicalExecutions(
  manifest: Manifest | undefined,
  history: HistoryArtifact | undefined
): UnifiedExecution[] {
  const currentIds = new Set((manifest?.unifiedExecutions ?? []).map((item) => item.id));
  const automated = (history?.runs ?? [])
    .filter((run) => !currentIds.has(run.id))
    .map(
      (run): UnifiedExecution => ({
        id: run.id,
        type: "automated",
        project: run.projectKey,
        ...(run.release ? { release: run.release } : {}),
        ...(run.branch ? { branch: run.branch } : {}),
        ...(run.environment ? { environment: run.environment } : {}),
        ...(run.commit ? { commit: run.commit } : {}),
        ...(run.workflowRun ? { workflowRun: run.workflowRun } : {}),
        ...(run.startedAt ? { startedAt: run.startedAt } : {}),
        ...(run.completedAt ? { completedAt: run.completedAt } : {}),
        reportedAt: run.reportedAt,
        status: run.status,
        counts: run.counts,
        ...(run.wallClockDurationMs !== undefined
          ? { durationMs: run.wallClockDurationMs }
          : {}),
        ...(run.testDurationSumMs !== undefined
          ? { testDurationSumMs: run.testDurationSumMs }
          : {}),
        testCaseIds: [...new Set(run.caseResults.map((item) => item.testCaseId))],
        caseResults: run.caseResults.map((item) => ({
          testCaseId: item.testCaseId,
          ...(item.implementationId ? { implementationId: item.implementationId } : {}),
          status: item.status,
          ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
          ...(item.attemptCount ? { attempt: item.attemptCount - 1 } : {})
        })),
        requirementIds: [],
        defectIds: [],
        ...(run.sourceReport?.url ? { sourceReport: run.sourceReport.url } : {}),
        caseResultsAvailable: true
      })
    );
  const manual = (history?.manualExecutions ?? [])
    .filter((execution) => !currentIds.has(execution.executionId))
    .map(
      (execution): UnifiedExecution => ({
        id: execution.executionId,
        type: "manual",
        project: execution.projectKey,
        ...(execution.release ? { release: execution.release } : {}),
        ...(execution.environment ? { environment: execution.environment } : {}),
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        status: execution.status,
        counts: {
          total: execution.caseResults.length,
          passed: execution.caseResults.filter((item) => item.status === "passed").length,
          failed: execution.caseResults.filter((item) => item.status === "failed").length,
          blocked: execution.caseResults.filter((item) => item.status === "blocked").length,
          skipped: execution.caseResults.filter((item) => item.status === "skipped").length,
          notRun: execution.caseResults.filter((item) => item.status === "not-run").length
        },
        testCaseIds: execution.caseResults.map((item) => item.testCaseId),
        caseResults: execution.caseResults,
        requirementIds: [],
        defectIds: [],
        ...(execution.tester ? { tester: execution.tester } : {}),
        ...(execution.testedBuild ? { testedBuild: execution.testedBuild } : {}),
        ...(execution.sourceReport?.url
          ? { sourceReport: execution.sourceReport.url }
          : {}),
        caseResultsAvailable: true
      })
    );
  return [...automated, ...manual];
}
