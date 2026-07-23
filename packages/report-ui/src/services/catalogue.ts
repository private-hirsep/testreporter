import type {
  CatalogueStatus,
  Manifest,
  TestCase,
  TestCaseCatalogueEntry,
  UnifiedExecution
} from "../types";

export function catalogueFor(manifest: Manifest | undefined, tests: TestCase[]): TestCaseCatalogueEntry[] {
  if (manifest?.testCaseCatalogue) return manifest.testCaseCatalogue;
  return tests.map((test) => ({
    id: test.id,
    canonicalId: test.identity?.canonicalId ?? test.id,
    displayId: test.identity?.canonicalId ?? test.id,
    identity: {
      source: test.identity?.source ?? "generated",
      stable: test.identity?.stable ?? false,
      conflict: false
    },
    title: test.fullName ?? test.name,
    type: "automated",
    requirements: test.requirements,
    defects: test.defects ?? [],
    tags: test.tags ?? [],
    implementations: [
      {
        technicalId: test.identity?.technicalId ?? test.id,
        kind: "automated",
        title: test.fullName ?? test.name,
        framework: test.framework,
        layer: test.layer,
        ...((test.file || test.line)
          ? { source: { ...(test.file ? { file: test.file } : {}), ...(test.line ? { line: test.line } : {}) } }
          : {}),
        ...(test.suite ? { suitePath: [test.suite] } : {}),
        requirements: test.requirements,
        defects: test.defects ?? [],
        tags: test.tags ?? [],
        ...(test.variant ? { variant: test.variant } : {}),
        active: true,
        latestResult: {
          status: test.status as CatalogueStatus,
          ...(test.executedAt ? { executedAt: test.executedAt } : {}),
          ...(test.durationMs !== undefined ? { durationMs: test.durationMs } : {})
        }
      }
    ],
    latestResult: {
      status: test.status as CatalogueStatus,
      ...(test.executedAt ? { executedAt: test.executedAt } : {}),
      contributingStatuses: [test.status as CatalogueStatus]
    },
    stability: {
      available: false,
      sampleSize: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      source: "insufficient-data"
    },
    ...(test.executedAt ? { lastExecutedAt: test.executedAt } : {}),
    ...(test.durationMs !== undefined
      ? {
          duration: {
            sampleSize: 1,
            averageMs: test.durationMs,
            medianMs: test.durationMs,
            minMs: test.durationMs,
            maxMs: test.durationMs,
            source: "automated" as const
          }
        }
      : {})
  }));
}

export type ResolvedUnifiedExecution = UnifiedExecution & {
  caseResults: NonNullable<UnifiedExecution["caseResults"]>;
  caseResultsAvailable: boolean;
};

export function executionsFor(manifest: Manifest | undefined): ResolvedUnifiedExecution[] {
  return (manifest?.unifiedExecutions ?? []).map((execution) => ({
    ...execution,
    caseResultsAvailable: execution.caseResults !== undefined,
    caseResults:
      execution.caseResults ??
      execution.testCaseIds.map((testCaseId) => ({
        testCaseId,
        status: "unknown" as const
      }))
  }));
}
