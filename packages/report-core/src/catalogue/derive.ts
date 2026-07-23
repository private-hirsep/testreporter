import { z } from "zod";

import type {
  IdentityDiagnostics,
  NormalizedTestCase,
  RunMetadata,
  TestStatus
} from "../schema/report.js";
import type { ManualCase, ManualExecution, ManualStatus } from "../schema/manual.js";
import { stableId } from "../utils/hash.js";
import { analyzeCanonicalIdentityGroup } from "./identity.js";

export const CatalogueResultStatusSchema = z.enum([
  "broken",
  "failed",
  "blocked",
  "not-run",
  "skipped",
  "passed",
  "unknown"
]);

const LatestResultSchema = z.object({
  status: CatalogueResultStatusSchema,
  executedAt: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  executionId: z.string().optional()
});

const DefinitionHistorySchema = z.object({
  confidence: z.enum(["exact-id", "source-range", "file-level", "unavailable"]),
  sourcePath: z.string().optional(),
  earliest: z
    .object({
      hash: z.string(),
      author: z.string(),
      date: z.string(),
      message: z.string(),
      url: z.string().url().optional()
    })
    .optional(),
  latest: z
    .object({
      hash: z.string(),
      author: z.string(),
      date: z.string(),
      message: z.string(),
      url: z.string().url().optional()
    })
    .optional(),
  revisions: z
    .array(
      z.object({
        hash: z.string(),
        author: z.string(),
        date: z.string(),
        message: z.string(),
        url: z.string().url().optional()
      })
    )
    .default([])
});

export const TestCaseImplementationSchema = z.object({
  technicalId: z.string(),
  kind: z.enum(["automated", "manual"]),
  title: z.string(),
  framework: z.string().optional(),
  layer: z.string().optional(),
  source: z.object({ file: z.string().optional(), line: z.number().int().positive().optional() }).optional(),
  suitePath: z.array(z.string()).optional(),
  variant: z.record(z.string()).optional(),
  requirements: z.array(z.string()),
  defects: z.array(z.string()),
  tags: z.array(z.string()),
  active: z.boolean().default(true),
  latestResult: LatestResultSchema.optional()
});

export const TestCaseCatalogueEntrySchema = z.object({
  id: z.string(),
  canonicalId: z.string(),
  displayId: z.string(),
  identity: z.object({
    source: z.enum(["explicit", "title-token", "mapping", "generated"]),
    stable: z.boolean(),
    conflict: z.boolean()
  }),
  title: z.string(),
  type: z.enum(["automated", "manual", "hybrid"]),
  lifecycleStatus: z.enum(["draft", "approved", "deprecated"]).optional(),
  requirements: z.array(z.string()),
  defects: z.array(z.string()),
  tags: z.array(z.string()),
  implementations: z.array(TestCaseImplementationSchema),
  latestResult: LatestResultSchema.extend({ contributingStatuses: z.array(CatalogueResultStatusSchema) }).optional(),
  lastExecutedAt: z.string().optional(),
  stability: z.object({
    available: z.boolean(),
    sampleSize: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    flaky: z.number().int().nonnegative(),
    passRate: z.number().min(0).max(100).optional(),
    source: z.enum(["current-report", "available-history", "insufficient-data"]),
    unavailableReason: z.enum(["identity-conflict"]).optional()
  }),
  duration: z
    .object({
      sampleSize: z.number().int().positive(),
      latestMs: z.number().nonnegative().optional(),
      averageMs: z.number().nonnegative().optional(),
      medianMs: z.number().nonnegative().optional(),
      minMs: z.number().nonnegative().optional(),
      maxMs: z.number().nonnegative().optional(),
      source: z.enum(["automated", "manual", "mixed"])
    })
    .optional(),
  definitionHistory: z.array(DefinitionHistorySchema).optional(),
  evidence: z
    .object({ attachmentCount: z.number().int().nonnegative(), references: z.array(z.string()) })
    .optional()
});

export const UnifiedExecutionSchema = z.object({
  id: z.string(),
  type: z.enum(["automated", "manual"]),
  project: z.string(),
  release: z.string().optional(),
  branch: z.string().optional(),
  environment: z.string().optional(),
  commit: z.string().optional(),
  workflowRun: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  reportedAt: z.string().optional(),
  status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]),
  counts: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    broken: z.number().int().nonnegative().optional(),
    blocked: z.number().int().nonnegative().optional(),
    skipped: z.number().int().nonnegative().optional(),
    notRun: z.number().int().nonnegative().optional(),
    unknown: z.number().int().nonnegative().optional()
  }),
  durationMs: z.number().nonnegative().optional(),
  testDurationSumMs: z.number().nonnegative().optional(),
  testCaseIds: z.array(z.string()),
  caseResults: z
    .array(
      z.object({
        testCaseId: z.string(),
        implementationId: z.string().optional(),
        status: CatalogueResultStatusSchema,
        durationMs: z.number().nonnegative().optional(),
        evidenceCount: z.number().int().nonnegative().optional(),
        evidenceReferences: z.array(z.string()).optional(),
        defects: z.array(z.string()).optional(),
        notes: z.array(z.string()).optional(),
        attempt: z.number().int().nonnegative().optional()
      })
    )
    .default([]),
  requirementIds: z.array(z.string()),
  defectIds: z.array(z.string()),
  evidence: z
    .object({ complete: z.boolean(), referenceCount: z.number().int().nonnegative() })
    .optional(),
  tester: z.string().optional(),
  testedBuild: z.string().optional(),
  notes: z.array(z.string()).optional(),
  sourceReport: z.string().optional()
});

export type CatalogueResultStatus = z.infer<typeof CatalogueResultStatusSchema>;
export type TestCaseImplementation = z.infer<typeof TestCaseImplementationSchema>;
export type TestCaseCatalogueEntry = z.infer<typeof TestCaseCatalogueEntrySchema>;
export type UnifiedExecution = z.infer<typeof UnifiedExecutionSchema>;

const severity: Record<CatalogueResultStatus, number> = {
  broken: 0,
  failed: 1,
  blocked: 2,
  "not-run": 3,
  skipped: 4,
  passed: 5,
  unknown: 6
};

function sortedUnique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function validTime(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function validDuration(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function manualStatus(status: ManualStatus): CatalogueResultStatus {
  return status;
}

function automatedStatus(status: TestStatus): CatalogueResultStatus {
  return status;
}

type Candidate = {
  implementation: TestCaseImplementation;
  identitySource: "explicit" | "title-token" | "mapping" | "generated";
  identityStable: boolean;
  lifecycleStatus?: ManualCase["status"];
  history?: NonNullable<NormalizedTestCase["definitionHistory"]>;
  samples: Array<{
    status: CatalogueResultStatus;
    at?: string;
    durationMs?: number;
    flaky?: boolean;
    executionId?: string;
    implementationId: string;
  }>;
  evidence: string[];
  compatibilityTitle: string;
};

export type CatalogueInput = {
  tests: NormalizedTestCase[];
  manualCases: ManualCase[];
  manualExecutions: ManualExecution[];
  metadata: RunMetadata;
  identityDiagnostics?: IdentityDiagnostics;
};

export function deriveTestCaseCatalogue(input: CatalogueInput): TestCaseCatalogueEntry[] {
  const groups = new Map<string, Candidate[]>();
  const executions = deriveUnifiedExecutions(input);
  const executionSamplesByCase = new Map<
    string,
    Array<{ status: CatalogueResultStatus; flaky: boolean }>
  >();
  for (const execution of executions) {
    const resultsByCase = new Map<string, UnifiedExecution["caseResults"]>();
    for (const result of execution.caseResults) {
      const group = resultsByCase.get(result.testCaseId);
      if (group) group.push(result);
      else resultsByCase.set(result.testCaseId, [result]);
    }
    for (const [testCaseId, results] of resultsByCase) {
      const status = [...results].sort(
        (left, right) =>
          severity[left.status] - severity[right.status] ||
          (left.implementationId ?? "").localeCompare(right.implementationId ?? "")
      )[0]!.status;
      const group = executionSamplesByCase.get(testCaseId);
      const sample = {
        status,
        flaky: status === "passed" && results.some((result) => (result.attempt ?? 0) > 0)
      };
      if (group) group.push(sample);
      else executionSamplesByCase.set(testCaseId, [sample]);
    }
  }
  const push = (canonicalId: string, candidate: Candidate) => {
    const group = groups.get(canonicalId);
    if (group) group.push(candidate);
    else groups.set(canonicalId, [candidate]);
  };

  for (const test of input.tests) {
    const canonicalId = test.identity?.canonicalId ?? test.id;
    const latestResult = {
      status: automatedStatus(test.status),
      ...(test.executedAt ? { executedAt: test.executedAt } : {}),
      ...(validDuration(test.durationMs) ? { durationMs: test.durationMs } : {})
    };
    push(canonicalId, {
      implementation: {
        technicalId: test.identity?.technicalId ?? test.id,
        kind: "automated",
        title: test.fullName ?? test.name,
        framework: test.framework,
        layer: test.layer,
        ...((test.file || test.line) ? { source: { ...(test.file ? { file: test.file } : {}), ...(test.line ? { line: test.line } : {}) } } : {}),
        ...(test.suite ? { suitePath: test.suite.split(/(?:\s*>\s*|\/)/).filter(Boolean) } : {}),
        ...(test.variant && Object.keys(test.variant).length ? { variant: test.variant } : {}),
        requirements: sortedUnique(test.requirements),
        defects: sortedUnique(test.defects),
        tags: sortedUnique(test.tags),
        active: true,
        latestResult
      },
      identitySource: test.identity?.source ?? "generated",
      identityStable: test.identity?.stable ?? false,
      ...(test.definitionHistory ? { history: test.definitionHistory } : {}),
      samples: [
        {
          status: latestResult.status,
          ...(latestResult.executedAt ? { at: latestResult.executedAt } : {}),
          ...(latestResult.durationMs !== undefined
            ? { durationMs: latestResult.durationMs }
            : {}),
          flaky: test.retries > 0 && test.status === "passed",
          implementationId: test.identity?.technicalId ?? test.id
        }
      ],
      evidence: (test.attachments ?? []).map((item) => item.path),
      compatibilityTitle: test.name
    });
  }

  const completed = input.manualExecutions
    .filter((execution) => execution.state === "completed" && execution.completedAt)
    .sort(
      (a, b) =>
        validTime(a.completedAt) - validTime(b.completedAt) ||
        a.executionId.localeCompare(b.executionId)
    );
  const resultsByCase = new Map<string, Array<{ execution: ManualExecution; result: ManualExecution["cases"][number] }>>();
  for (const execution of completed)
    for (const result of execution.cases)
      {
        const group = resultsByCase.get(result.caseId);
        if (group) group.push({ execution, result });
        else resultsByCase.set(result.caseId, [{ execution, result }]);
      }

  for (const manualCase of input.manualCases) {
    const samples = (resultsByCase.get(manualCase.id) ?? []).map(({ execution, result }) => ({
      status: manualStatus(result.status),
      ...(execution.completedAt ? { at: execution.completedAt } : {}),
      executionId: execution.executionId,
      implementationId: `manual:${manualCase.id}`
    }));
    const latest = samples.at(-1);
    const active = manualCase.status === "approved";
    push(manualCase.id, {
      implementation: {
        technicalId: `manual:${manualCase.id}`,
        kind: "manual",
        title: manualCase.title,
        ...(manualCase.sourcePath ? { source: { file: manualCase.sourcePath } } : {}),
        requirements: sortedUnique(manualCase.requirements),
        defects: sortedUnique(
          (resultsByCase.get(manualCase.id) ?? []).flatMap(({ result }) => result.defects)
        ),
        tags: sortedUnique(manualCase.tags),
        active,
        ...(active && latest
          ? {
              latestResult: {
                status: latest.status,
                ...(latest.at ? { executedAt: latest.at } : {}),
                ...(latest.executionId ? { executionId: latest.executionId } : {})
              }
            }
          : {})
      },
      identitySource: "explicit",
      identityStable: true,
      lifecycleStatus: manualCase.status,
      ...(manualCase.definitionHistory ? { history: manualCase.definitionHistory } : {}),
      samples: active ? samples : [],
      evidence: (resultsByCase.get(manualCase.id) ?? []).flatMap(({ result }) => [
        ...result.evidence,
        ...result.steps.flatMap((step) => step.evidence)
      ]),
      compatibilityTitle: manualCase.title
    });
  }

  return [...groups]
    .map(([canonicalId, candidates]): TestCaseCatalogueEntry => {
      const implementations = candidates
        .map((candidate) => candidate.implementation)
        .sort((a, b) => a.technicalId.localeCompare(b.technicalId));
      const activeResults = implementations
        .filter((implementation) => implementation.active && implementation.latestResult)
        .map((implementation) => implementation.latestResult!);
      const latestResult = activeResults.length
        ? [...activeResults].sort(
            (a, b) =>
              severity[a.status] - severity[b.status] ||
              validTime(b.executedAt) - validTime(a.executedAt) ||
              (a.executionId ?? "").localeCompare(b.executionId ?? "")
          )[0]
        : undefined;
      const lastExecutedResult = activeResults
        .filter((result) => Number.isFinite(validTime(result.executedAt)))
        .sort(
          (left, right) =>
            validTime(right.executedAt) - validTime(left.executedAt) ||
            left.status.localeCompare(right.status) ||
            (left.executionId ?? "").localeCompare(right.executionId ?? "")
        )[0];
      const stabilitySamples = executionSamplesByCase.get(canonicalId) ?? [];
      const hasAvailableHistory = stabilitySamples.length >= 2;
      const passed = stabilitySamples.filter((sample) => sample.status === "passed").length;
      const failed = stabilitySamples.filter((sample) =>
        ["failed", "broken", "blocked"].includes(sample.status)
      ).length;
      const flaky = stabilitySamples.filter((sample) => sample.flaky).length;
      const durations = candidates.flatMap((candidate) =>
        candidate.samples
          .map((sample) => sample.durationMs)
          .filter((value): value is number => validDuration(value))
      );
      const sortedDurations = [...durations].sort((a, b) => a - b);
      const middle = Math.floor(sortedDurations.length / 2);
      const median =
        sortedDurations.length % 2
          ? sortedDurations[middle]
          : sortedDurations.length
            ? (sortedDurations[middle - 1]! + sortedDurations[middle]!) / 2
            : undefined;
      const approvedManualTitle = candidates
        .filter((candidate) => candidate.lifecycleStatus === "approved")
        .map((candidate) => candidate.implementation.title)
        .sort()[0];
      const explicitAutomatedTitle = candidates
        .filter(
          (candidate) =>
            candidate.implementation.kind === "automated" &&
            candidate.identitySource === "explicit" &&
            candidate.identityStable
        )
        .map((candidate) => candidate.implementation.title)
        .sort()[0];
      const title =
        approvedManualTitle ??
        explicitAutomatedTitle ??
        [...implementations]
          .sort(
            (a, b) =>
              validTime(b.latestResult?.executedAt) - validTime(a.latestResult?.executedAt) ||
              a.title.localeCompare(b.title)
          )[0]!.title;
      const kinds = new Set(implementations.map((implementation) => implementation.kind));
      const identitySources = candidates.map((candidate) => candidate.identitySource);
      const identitySource = identitySources.includes("explicit")
        ? "explicit"
        : identitySources.includes("title-token")
          ? "title-token"
          : identitySources.includes("mapping")
            ? "mapping"
            : "generated";
      const conflict = !analyzeCanonicalIdentityGroup(
        canonicalId,
        candidates.map((candidate) => ({
          title: candidate.compatibilityTitle,
          ...(candidate.implementation.variant
            ? { variant: candidate.implementation.variant }
            : {})
        }))
      ).compatible;
      const histories = candidates
        .map((candidate) => candidate.history)
        .filter((history): history is NonNullable<typeof history> => Boolean(history));
      const evidence = sortedUnique(candidates.flatMap((candidate) => candidate.evidence));
      const durationKinds = new Set(
        candidates
          .filter((candidate) => candidate.samples.some((sample) => validDuration(sample.durationMs)))
          .map((candidate) => candidate.implementation.kind)
      );
      return {
        id: stableId(["catalogue", canonicalId]),
        canonicalId,
        displayId: canonicalId,
        identity: {
          source: identitySource,
          stable: !conflict && candidates.every((candidate) => candidate.identityStable),
          conflict
        },
        title,
        type: kinds.size === 2 ? "hybrid" : kinds.has("manual") ? "manual" : "automated",
        ...(candidates.some((candidate) => candidate.lifecycleStatus)
          ? {
              lifecycleStatus: candidates
                .map((candidate) => candidate.lifecycleStatus)
                .filter((status): status is ManualCase["status"] => Boolean(status))
                .sort(
                  (a, b) =>
                    ({ approved: 0, draft: 1, deprecated: 2 })[a] -
                    ({ approved: 0, draft: 1, deprecated: 2 })[b]
                )[0]
            }
          : {}),
        requirements: sortedUnique(implementations.flatMap((item) => item.requirements)),
        defects: sortedUnique(implementations.flatMap((item) => item.defects)),
        tags: sortedUnique(implementations.flatMap((item) => item.tags)),
        implementations,
        ...(latestResult
          ? {
              latestResult: {
                ...latestResult,
                contributingStatuses: activeResults.map((result) => result.status).sort()
              }
            }
          : {}),
        ...(lastExecutedResult?.executedAt
          ? { lastExecutedAt: lastExecutedResult.executedAt }
          : {}),
        stability: {
          available: !conflict && hasAvailableHistory,
          sampleSize: stabilitySamples.length,
          passed,
          failed,
          flaky,
          ...(conflict ? { unavailableReason: "identity-conflict" as const } : {}),
          ...(!conflict && hasAvailableHistory
            ? { passRate: round((passed / stabilitySamples.length) * 100) }
            : {}),
          source: hasAvailableHistory ? "available-history" : "insufficient-data"
        },
        ...(durations.length
          ? {
              duration: {
                sampleSize: durations.length,
                ...(() => {
                  const latest = [...candidates]
                    .flatMap((candidate) => candidate.samples)
                    .filter(
                      (sample) =>
                        validDuration(sample.durationMs) &&
                        Number.isFinite(validTime(sample.at))
                    )
                    .sort(
                      (a, b) =>
                        validTime(b.at) - validTime(a.at) ||
                        a.implementationId.localeCompare(b.implementationId)
                    )[0];
                  return latest ? { latestMs: latest.durationMs } : {};
                })(),
                averageMs: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
                ...(median !== undefined ? { medianMs: round(median) } : {}),
                minMs: sortedDurations[0],
                maxMs: sortedDurations.at(-1),
                source:
                  durationKinds.size > 1
                    ? "mixed"
                    : durationKinds.has("manual")
                      ? "manual"
                      : "automated"
              }
            }
          : {}),
        ...(histories.length ? { definitionHistory: histories } : {}),
        ...(evidence.length ? { evidence: { attachmentCount: evidence.length, references: evidence } } : {})
      };
    })
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

function executionDuration(startedAt: string | undefined, completedAt: string | undefined) {
  const start = validTime(startedAt);
  const end = validTime(completedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : undefined;
}

function automatedExecutionStatus(counts: {
  total: number;
  passed: number;
  failed: number;
  broken: number;
  skipped: number;
  unknown: number;
}) {
  if (counts.failed || counts.broken) return "failed" as const;
  if (counts.unknown) return "unknown" as const;
  if (counts.passed > 0 && counts.passed + counts.skipped === counts.total)
    return "passed" as const;
  if (counts.total > 0 && counts.skipped === counts.total) return "incomplete" as const;
  return "unknown" as const;
}

function manualExecutionStatus(counts: {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
}) {
  if (counts.failed) return "failed" as const;
  if (counts.blocked) return "blocked" as const;
  if (counts.passed > 0 && counts.passed + counts.skipped === counts.total)
    return "passed" as const;
  if (counts.total > 0 && counts.skipped + counts.notRun === counts.total)
    return "incomplete" as const;
  return "unknown" as const;
}

export function deriveUnifiedExecutions(input: CatalogueInput): UnifiedExecution[] {
  const executions: UnifiedExecution[] = [];
  if (input.tests.length) {
    const counts = {
      total: input.tests.length,
      passed: input.tests.filter((test) => test.status === "passed").length,
      failed: input.tests.filter((test) => test.status === "failed").length,
      broken: input.tests.filter((test) => test.status === "broken").length,
      skipped: input.tests.filter((test) => test.status === "skipped").length,
      unknown: input.tests.filter((test) => test.status === "unknown").length
    };
    const requirements = sortedUnique(input.tests.flatMap((test) => test.requirements));
    const defects = sortedUnique(input.tests.flatMap((test) => test.defects));
    const id =
      input.metadata.runId ??
      input.metadata.workflowRun ??
      `automated-${stableId([
        input.metadata.projectKey ?? input.metadata.projectName,
        input.metadata.generatedAt,
        input.metadata.commitSha,
        input.metadata.branch
      ])}`;
    executions.push({
      id,
      type: "automated",
      project: input.metadata.projectKey ?? input.metadata.projectName,
      ...(input.metadata.release ? { release: input.metadata.release } : {}),
      ...(input.metadata.branch ? { branch: input.metadata.branch } : {}),
      ...(input.metadata.environment ? { environment: input.metadata.environment } : {}),
      ...(input.metadata.commitSha ? { commit: input.metadata.commitSha } : {}),
      ...(input.metadata.workflowRun ? { workflowRun: input.metadata.workflowRun } : {}),
      reportedAt: input.metadata.generatedAt,
      status: automatedExecutionStatus(counts),
      counts,
      ...(() => {
        const durations = input.tests
          .map((test) => test.durationMs)
          .filter((value): value is number => validDuration(value));
        return durations.length
          ? { testDurationSumMs: durations.reduce((sum, value) => sum + value, 0) }
          : {};
      })(),
      testCaseIds: sortedUnique(input.tests.map((test) => test.identity?.canonicalId ?? test.id)),
      caseResults: input.tests
        .map((test) => {
          const evidenceReferences = sortedUnique(test.attachments.map((item) => item.path));
          return {
            testCaseId: test.identity?.canonicalId ?? test.id,
            implementationId: test.identity?.technicalId ?? test.id,
            status: automatedStatus(test.status),
            ...(validDuration(test.durationMs) ? { durationMs: test.durationMs } : {}),
            evidenceCount: evidenceReferences.length,
            ...(evidenceReferences.length ? { evidenceReferences } : {}),
            ...(test.defects.length ? { defects: sortedUnique(test.defects) } : {}),
            ...(test.error?.message ? { notes: [test.error.message] } : {}),
            ...(test.retries > 0 ? { attempt: test.retries } : {})
          };
        })
        .sort(
          (left, right) =>
            left.testCaseId.localeCompare(right.testCaseId) ||
            left.implementationId.localeCompare(right.implementationId)
        ),
      requirementIds: requirements,
      defectIds: defects,
      evidence: {
        complete: input.tests.every((test) => !["failed", "broken"].includes(test.status) || Boolean(test.attachments.length || test.error)),
        referenceCount: input.tests.reduce((sum, test) => sum + test.attachments.length, 0)
      },
      sourceReport: "normalized-report.json"
    });
  }

  const manualById = new Map(input.manualCases.map((manualCase) => [manualCase.id, manualCase]));
  for (const execution of input.manualExecutions.filter(
    (item) =>
      item.state === "completed" &&
      Boolean(item.completedAt) &&
      item.cases.every((result) => manualById.get(result.caseId)?.status === "approved")
  )) {
    const counts = {
      total: execution.cases.length,
      passed: execution.cases.filter((item) => item.status === "passed").length,
      failed: execution.cases.filter((item) => item.status === "failed").length,
      blocked: execution.cases.filter((item) => item.status === "blocked").length,
      skipped: execution.cases.filter((item) => item.status === "skipped").length,
      notRun: execution.cases.filter((item) => item.status === "not-run").length
    };
    const evidenceReferences = execution.cases.flatMap((item) => [
      ...item.evidence,
      ...item.steps.flatMap((step) => step.evidence)
    ]);
    executions.push({
      id: execution.executionId,
      type: "manual",
      project: execution.projectKey,
      ...(execution.release ? { release: execution.release } : {}),
      environment: execution.environment,
      ...(execution.sourceCommit ? { commit: execution.sourceCommit } : {}),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      status: manualExecutionStatus(counts),
      counts,
      ...(executionDuration(execution.startedAt, execution.completedAt) !== undefined
        ? { durationMs: executionDuration(execution.startedAt, execution.completedAt) }
        : {}),
      testCaseIds: sortedUnique(execution.cases.map((item) => item.caseId)),
      caseResults: execution.cases
        .map((item) => {
          const evidenceReferences = sortedUnique([
            ...item.evidence,
            ...item.steps.flatMap((step) => step.evidence)
          ]);
          const notes = [item.actualResult, item.notes, ...item.steps.flatMap((step) => [
            step.actualResult,
            step.notes
          ])].filter((value): value is string => Boolean(value));
          return {
            testCaseId: item.caseId,
            status: manualStatus(item.status),
            evidenceCount: evidenceReferences.length,
            ...(evidenceReferences.length ? { evidenceReferences } : {}),
            ...(item.defects.length ? { defects: sortedUnique(item.defects) } : {}),
            ...(notes.length ? { notes } : {})
          };
        })
        .sort((left, right) => left.testCaseId.localeCompare(right.testCaseId)),
      requirementIds: sortedUnique(
        execution.cases.flatMap((item) => manualById.get(item.caseId)?.requirements ?? [])
      ),
      defectIds: sortedUnique(execution.cases.flatMap((item) => item.defects)),
      evidence: {
        complete: execution.cases.every((item) => item.evidence.length || item.steps.some((step) => step.evidence.length)),
        referenceCount: evidenceReferences.length
      },
      tester: execution.tester,
      testedBuild: execution.testedBuild,
      notes: execution.cases.flatMap((item) => [item.actualResult, item.notes]).filter((value): value is string => Boolean(value)),
      sourceReport: "imported manual execution"
    });
  }
  return executions.sort(
    (a, b) =>
      validTime(b.completedAt ?? b.startedAt ?? b.reportedAt) -
        validTime(a.completedAt ?? a.startedAt ?? a.reportedAt) ||
      a.id.localeCompare(b.id)
  );
}
