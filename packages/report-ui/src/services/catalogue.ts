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
        active: true,
        latestResult: {
          status: test.status as CatalogueStatus,
          ...(test.durationMs !== undefined ? { durationMs: test.durationMs } : {})
        }
      }
    ],
    latestResult: {
      status: test.status as CatalogueStatus,
      contributingStatuses: [test.status as CatalogueStatus]
    },
    stability: {
      available: false,
      sampleSize: 1,
      passed: test.status === "passed" ? 1 : 0,
      failed: ["failed", "broken"].includes(test.status) ? 1 : 0,
      flaky: test.retries > 0 && test.status === "passed" ? 1 : 0,
      source: "insufficient-data"
    },
    ...(test.durationMs !== undefined
      ? {
          duration: {
            sampleSize: 1,
            latestMs: test.durationMs,
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

export function executionsFor(manifest: Manifest | undefined): UnifiedExecution[] {
  return manifest?.unifiedExecutions ?? [];
}
