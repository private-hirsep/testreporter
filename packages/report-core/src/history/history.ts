import { z } from "zod";

import type { NormalizedReport } from "../schema/report.js";
import { stableId } from "../utils/hash.js";

const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "historical links must use HTTP or HTTPS"
  });

export const HISTORY_SCHEMA_VERSION = "1.0";

export const HistoryDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning", "information"]),
  code: z.string(),
  message: z.string(),
  artifact: z.string().optional()
});

export const HistoricalCaseResultSnapshotSchema = z.object({
  testCaseId: z.string(),
  implementationId: z.string().optional(),
  status: z.enum(["passed", "failed", "broken", "blocked", "not-run", "skipped", "unknown"]),
  durationMs: z.number().nonnegative().optional(),
  attemptCount: z.number().int().positive().optional(),
  flakyInRun: z.boolean().optional(),
  identity: z.object({
    source: z.string(),
    stable: z.boolean(),
    conflict: z.boolean()
  })
});

const CountsSchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  broken: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  notRun: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative()
});

export const HistoricalRunSummarySchema = z.object({
  id: z.string(),
  type: z.literal("automated"),
  projectKey: z.string(),
  release: z.string().optional(),
  branch: z.string().optional(),
  environment: z.string().optional(),
  commit: z.string().optional(),
  workflowRun: z.string().optional(),
  workflowAttempt: z.number().int().positive().optional(),
  reportedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  wallClockDurationMs: z.number().nonnegative().optional(),
  testDurationSumMs: z.number().nonnegative().optional(),
  status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]),
  counts: CountsSchema,
  qualityGate: z.object({ status: z.string(), profile: z.string().optional() }).optional(),
  readiness: z
    .object({
      status: z.string(),
      blockers: z.number().int().nonnegative(),
      warnings: z.number().int().nonnegative(),
      acceptedRisks: z.number().int().nonnegative()
    })
    .optional(),
  requirements: z
    .object({
      covered: z.number().int().nonnegative(),
      uncovered: z.number().int().nonnegative(),
      excluded: z.number().int().nonnegative(),
      total: z.number().int().nonnegative()
    })
    .optional(),
  coverage: z
    .object({
      line: z.number().min(0).max(100).optional(),
      branch: z.number().min(0).max(100).optional(),
      function: z.number().min(0).max(100).optional(),
      statement: z.number().min(0).max(100).optional()
    })
    .optional(),
  security: z.object({
    blockers: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative()
  }).optional(),
  caseResults: z.array(HistoricalCaseResultSnapshotSchema),
  sourceReport: z.object({ url: HttpUrlSchema.optional(), evidenceUrl: HttpUrlSchema.optional() }).optional()
});

export const HistoricalManualExecutionSummarySchema = z.object({
  executionId: z.string(),
  projectKey: z.string(),
  release: z.string().optional(),
  environment: z.string().optional(),
  testedBuild: z.string().optional(),
  tester: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]),
  caseResults: z.array(
    z.object({
      testCaseId: z.string(),
      status: z.enum(["passed", "failed", "blocked", "not-run", "skipped", "unknown"])
    })
  ),
  sourceReport: z.object({ url: HttpUrlSchema.optional(), evidenceUrl: HttpUrlSchema.optional() }).optional()
});

export const HistoryRetentionMetadataSchema = z.object({
  maxRuns: z.number().int().positive(),
  maxAgeDays: z.number().int().positive(),
  maxManualExecutions: z.number().int().positive(),
  prunedRuns: z.number().int().nonnegative().default(0),
  prunedManualExecutions: z.number().int().nonnegative().default(0)
});

export const ProjectHistoryStoreSchema = z.object({
  schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
  project: z.object({ key: z.string(), name: z.string() }),
  generatedAt: z.string().datetime(),
  retention: HistoryRetentionMetadataSchema,
  runs: z.array(HistoricalRunSummarySchema),
  manualExecutions: z.array(HistoricalManualExecutionSummarySchema),
  diagnostics: z.array(HistoryDiagnosticSchema).default([])
});

export type HistoricalRunSummary = z.infer<typeof HistoricalRunSummarySchema>;
export type HistoricalManualExecutionSummary = z.infer<
  typeof HistoricalManualExecutionSummarySchema
>;
export type ProjectHistoryStore = z.infer<typeof ProjectHistoryStoreSchema>;
export type HistoryDiagnostic = z.infer<typeof HistoryDiagnosticSchema>;

export interface HistoryOptions {
  maxRuns?: number;
  maxAgeDays?: number;
  maxManualExecutions?: number;
  minimumSamples?: number;
  flakyTransitionThreshold?: number;
  durationMinimumSamples?: number;
  durationRegressionPercent?: number;
  durationMinimumIncreaseMs?: number;
}

export const DEFAULT_HISTORY_OPTIONS = {
  maxRuns: 50,
  maxAgeDays: 180,
  maxManualExecutions: 200,
  minimumSamples: 5,
  flakyTransitionThreshold: 2,
  durationMinimumSamples: 3,
  durationRegressionPercent: 30,
  durationMinimumIncreaseMs: 500
} satisfies Required<HistoryOptions>;

const validTime = (value: string | undefined) => {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const runTime = (run: HistoricalRunSummary) =>
  validTime(run.completedAt ?? run.startedAt ?? run.reportedAt);

const canonical = (value: unknown) => JSON.stringify(value);

function aggregateStatus(statuses: string[]) {
  const order = ["broken", "failed", "blocked", "not-run", "skipped", "passed", "unknown"];
  return order.find((status) => statuses.includes(status)) ?? "unknown";
}

export function deriveCurrentRunSummary(
  report: NormalizedReport,
  sourceReportUrl?: string
): HistoricalRunSummary | undefined {
  const execution = report.unifiedExecutions?.find((item) => item.type === "automated");
  if (!execution) return undefined;
  const projectKey = report.metadata.projectKey ?? report.metadata.projectName;
  const workflowAttempt = report.metadata.workflowAttempt;
  const id =
    report.metadata.runId ??
    (report.metadata.workflowRun
      ? `github-${report.metadata.workflowRun}-${workflowAttempt ?? 1}`
      : `run-${stableId([
          projectKey,
          report.metadata.commitSha,
          report.metadata.branch,
          report.metadata.environment,
          execution.reportedAt ?? report.metadata.generatedAt
        ])}`);
  const catalogue = new Map(
    (report.testCaseCatalogue ?? []).map((item) => [item.canonicalId, item.identity])
  );
  const securityBlockers =
    (report.summary.security.critical ?? 0) + (report.summary.security.high ?? 0);
  const readinessActions = report.readiness?.actions ?? [];
  return HistoricalRunSummarySchema.parse({
    id,
    type: "automated",
    projectKey,
    release: execution.release,
    branch: execution.branch,
    environment: execution.environment,
    commit: execution.commit,
    workflowRun: execution.workflowRun,
    ...(workflowAttempt ? { workflowAttempt } : {}),
    reportedAt: execution.reportedAt ?? report.metadata.generatedAt,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    wallClockDurationMs: execution.durationMs,
    testDurationSumMs: execution.testDurationSumMs,
    status: execution.status,
    counts: {
      total: execution.counts.total,
      passed: execution.counts.passed,
      failed: execution.counts.failed,
      broken: execution.counts.broken ?? 0,
      blocked: execution.counts.blocked ?? 0,
      skipped: execution.counts.skipped ?? 0,
      notRun: execution.counts.notRun ?? 0,
      unknown: execution.counts.unknown ?? 0
    },
    qualityGate: { status: report.qualityGate.status, profile: report.qualityGate.profile },
    readiness: report.readiness
      ? {
          status: report.readiness.status,
          blockers: readinessActions.filter((item) => item.severity === "blocker").length,
          warnings: readinessActions.filter((item) => item.severity === "warning").length,
          acceptedRisks: report.readiness.acceptedRisks.length
        }
      : undefined,
    requirements: {
      covered: report.requirements.covered.length,
      uncovered: report.requirements.missing.length,
      excluded: report.releaseScope?.excludedRequirements?.length ?? 0,
      total: report.requirements.expected.length
    },
    coverage: { line: report.summary.coverage.totalPercentage },
    security: {
      blockers: securityBlockers,
      warnings: report.summary.security.medium ?? 0,
      accepted: report.readiness?.acceptedRisks.length ?? 0
    },
    caseResults: execution.caseResults.map((result) => {
      const identity = catalogue.get(result.testCaseId) ?? {
        source: "generated",
        stable: false,
        conflict: false
      };
      return {
        testCaseId: result.testCaseId,
        implementationId: result.implementationId,
        status: result.status,
        durationMs: result.durationMs,
        attemptCount: result.attempt === undefined ? undefined : result.attempt + 1,
        flakyInRun: result.attempt === undefined ? undefined : result.attempt > 0 && result.status === "passed",
        identity
      };
    }),
    sourceReport: sourceReportUrl ? { url: sourceReportUrl } : undefined
  });
}

export function deriveManualExecutionSummaries(
  report: NormalizedReport,
  sourceReportUrl?: string
): HistoricalManualExecutionSummary[] {
  const validIds = new Set(
    (report.unifiedExecutions ?? []).filter((item) => item.type === "manual").map((item) => item.id)
  );
  return report.manualExecutions
    .filter(
      (item): item is typeof item & { completedAt: string } =>
        item.state === "completed" && Boolean(item.completedAt) && validIds.has(item.executionId)
    )
    .map((item) => {
      const statuses = item.cases.map((result) => result.status);
      const status = statuses.includes("failed")
        ? "failed"
        : statuses.includes("blocked")
          ? "blocked"
          : statuses.length && statuses.every((value) => value === "passed" || value === "skipped")
            ? "passed"
            : "incomplete";
      return HistoricalManualExecutionSummarySchema.parse({
        executionId: item.executionId,
        projectKey: item.projectKey,
        release: item.release,
        environment: item.environment,
        testedBuild: item.testedBuild,
        tester: item.tester,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        status,
        caseResults: item.cases.map((result) => ({
          testCaseId: result.caseId,
          status: result.status
        })),
        sourceReport: sourceReportUrl ? { url: sourceReportUrl } : undefined
      });
    });
}

export function emptyHistoryStore(
  project: { key: string; name: string },
  generatedAt: string,
  options: HistoryOptions = {}
): ProjectHistoryStore {
  const resolved = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    project,
    generatedAt,
    retention: {
      maxRuns: resolved.maxRuns,
      maxAgeDays: resolved.maxAgeDays,
      maxManualExecutions: resolved.maxManualExecutions,
      prunedRuns: 0,
      prunedManualExecutions: 0
    },
    runs: [],
    manualExecutions: [],
    diagnostics: []
  };
}

export function mergeProjectHistory(
  existing: ProjectHistoryStore | undefined,
  report: NormalizedReport,
  options: HistoryOptions = {},
  sourceReportUrl?: string
): ProjectHistoryStore {
  const resolved = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  const project = {
    key: report.metadata.projectKey ?? report.metadata.projectName,
    name: report.metadata.projectName
  };
  const store = existing
    ? ProjectHistoryStoreSchema.parse(existing)
    : emptyHistoryStore(project, report.metadata.generatedAt, resolved);
  if (store.project.key !== project.key)
    throw new Error(
      `History project mismatch: existing ${store.project.key}, current ${project.key}.`
    );
  for (const run of store.runs)
    if (run.projectKey !== store.project.key)
      throw new Error(
        `History run ${run.id} belongs to ${run.projectKey}, expected ${store.project.key}.`
      );
  for (const execution of store.manualExecutions)
    if (execution.projectKey !== store.project.key)
      throw new Error(
        `Manual execution ${execution.executionId} belongs to ${execution.projectKey}, expected ${store.project.key}.`
      );
  const diagnostics = [...store.diagnostics];
  const runById = new Map(store.runs.map((run) => [run.id, run]));
  const current = deriveCurrentRunSummary(report, sourceReportUrl);
  if (current) {
    const duplicate = runById.get(current.id);
    if (duplicate && canonical(duplicate) !== canonical(current))
      diagnostics.push({
        severity: "error",
        code: "HISTORY_RUN_CONFLICT",
        message: `Run ${current.id} already exists with conflicting immutable content.`
      });
    else runById.set(current.id, current);
  }
  const manualById = new Map(store.manualExecutions.map((item) => [item.executionId, item]));
  for (const item of deriveManualExecutionSummaries(report, sourceReportUrl)) {
    if (item.projectKey !== project.key)
      throw new Error(
        `Manual execution ${item.executionId} belongs to ${item.projectKey}, expected ${project.key}.`
      );
    const duplicate = manualById.get(item.executionId);
    if (!duplicate) manualById.set(item.executionId, item);
    else if (canonical(duplicate) !== canonical(item)) {
      const immutable = (value: HistoricalManualExecutionSummary) => ({
        executionId: value.executionId,
        projectKey: value.projectKey,
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        status: value.status,
        caseResults: value.caseResults
      });
      if (canonical(immutable(duplicate)) !== canonical(immutable(item)))
        diagnostics.push({
          severity: "error",
          code: "HISTORY_MANUAL_CONFLICT",
          message: `Manual execution ${item.executionId} has conflicting result data.`
        });
      else
        manualById.set(item.executionId, {
          ...duplicate,
          ...item,
          sourceReport: item.sourceReport ?? duplicate.sourceReport
        });
    }
  }
  const sortedRuns = [...runById.values()].sort(
    (a, b) => runTime(b) - runTime(a) || a.id.localeCompare(b.id)
  );
  const cutoff = Date.parse(report.metadata.generatedAt) - resolved.maxAgeDays * 86_400_000;
  const aged = sortedRuns.filter((run) => runTime(run) >= cutoff || run.id === current?.id);
  const retainedRuns = aged
    .filter((run, index) => index < resolved.maxRuns || run.id === current?.id)
    .sort((a, b) => runTime(b) - runTime(a) || a.id.localeCompare(b.id));
  const sortedManual = [...manualById.values()].sort(
    (a, b) =>
      validTime(b.completedAt) - validTime(a.completedAt) ||
      a.executionId.localeCompare(b.executionId)
  );
  const retainedManual = sortedManual.slice(0, resolved.maxManualExecutions);
  const prunedRuns = sortedRuns.length - retainedRuns.length;
  const prunedManualExecutions = sortedManual.length - retainedManual.length;
  if (prunedRuns || prunedManualExecutions)
    diagnostics.push({
      severity: "information",
      code: "HISTORY_RETENTION_PRUNED",
      message: `Retention pruned ${prunedRuns} automated run(s) and ${prunedManualExecutions} manual execution(s).`
    });
  return ProjectHistoryStoreSchema.parse({
    ...store,
    project,
    generatedAt: report.metadata.generatedAt,
    retention: {
      maxRuns: resolved.maxRuns,
      maxAgeDays: resolved.maxAgeDays,
      maxManualExecutions: resolved.maxManualExecutions,
      prunedRuns,
      prunedManualExecutions
    },
    runs: retainedRuns,
    manualExecutions: retainedManual,
    diagnostics
  });
}

export type HistoryTransition =
  | "newly-failing"
  | "first-observed-failing"
  | "persistently-failing"
  | "recovered"
  | "still-blocked"
  | "newly-blocked"
  | "not-executed"
  | "new-case"
  | "removed-or-missing"
  | "unchanged";

export interface HistoricalCaseSummary {
  testCaseId: string;
  streams: HistoricalCaseStreamSummary[];
  automated?: HistoricalCaseStreamSummary;
  manual?: HistoricalCaseStreamSummary[];
  aggregateCurrentStatus?: string;
  samples: Array<{
    executionId: string;
    type: "automated" | "manual";
    at: string;
    status: string;
    presence: "present" | "absent";
    branch?: string;
    environment?: string;
    release?: string;
    commit?: string;
    durationMs?: number;
    implementationResults?: HistoricalRunSummary["caseResults"];
    sourceReport?: { url?: string | undefined; evidenceUrl?: string | undefined };
  }>;
  currentStatus?: string;
  previousStatus?: string;
  transition: HistoryTransition;
  sampleSize: number;
  passed: number;
  failed: number;
  passRate?: number;
  consecutiveFailures: number;
  lastPassedAt?: string;
  lastFailedAt?: string;
  identityConfidence: "trusted" | "generated-low" | "conflicted";
  stability:
    | "insufficient-history"
    | "stable"
    | "historically-unstable"
    | "identity-conflict";
  passFailTransitions: number;
  duration?: {
    latestMs: number;
    medianMs: number;
    previousMs?: number;
    absoluteChangeMs?: number;
    percentageChange?: number;
    recentMedianMs: number;
    slowRegression: boolean;
  };
}

export interface HistoricalCaseStreamSummary {
  key: string;
  type: "automated" | "manual";
  branch?: string;
  environment?: string;
  samples: HistoricalCaseSummary["samples"];
  currentStatus?: string;
  previousStatus?: string;
  transition: HistoryTransition;
  sampleSize: number;
  passed: number;
  failed: number;
  passRate?: number;
  consecutiveFailures: number;
  lastPassedAt?: string;
  lastFailedAt?: string;
  stability: HistoricalCaseSummary["stability"];
  passFailTransitions: number;
  duration?: HistoricalCaseSummary["duration"];
}

const HistoryTransitionSchema = z.enum([
  "newly-failing",
  "first-observed-failing",
  "persistently-failing",
  "recovered",
  "still-blocked",
  "newly-blocked",
  "not-executed",
  "new-case",
  "removed-or-missing",
  "unchanged"
]);
const HistoricalSampleSchema = z.object({
  executionId: z.string().min(1),
  type: z.enum(["automated", "manual"]),
  at: z.string().datetime(),
  status: z.enum(["passed", "failed", "broken", "blocked", "not-run", "skipped", "unknown", "absent"]),
  presence: z.enum(["present", "absent"]),
  branch: z.string().optional(),
  environment: z.string().optional(),
  release: z.string().optional(),
  commit: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  implementationResults: z.array(HistoricalCaseResultSnapshotSchema).optional(),
  sourceReport: z.object({ url: HttpUrlSchema.optional(), evidenceUrl: HttpUrlSchema.optional() }).optional()
});
const DurationSummarySchema = z.object({
  latestMs: z.number().nonnegative(),
  medianMs: z.number().nonnegative(),
  previousMs: z.number().nonnegative().optional(),
  absoluteChangeMs: z.number().optional(),
  percentageChange: z.number().finite().optional(),
  recentMedianMs: z.number().nonnegative(),
  slowRegression: z.boolean()
});
const StreamSummarySchema = z.object({
  key: z.string(),
  type: z.enum(["automated", "manual"]),
  branch: z.string().optional(),
  environment: z.string().optional(),
  samples: z.array(HistoricalSampleSchema),
  currentStatus: z.string().optional(),
  previousStatus: z.string().optional(),
  transition: HistoryTransitionSchema,
  sampleSize: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(100).optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastPassedAt: z.string().datetime().optional(),
  lastFailedAt: z.string().datetime().optional(),
  stability: z.enum([
    "insufficient-history",
    "stable",
    "historically-unstable",
    "identity-conflict"
  ]),
  passFailTransitions: z.number().int().nonnegative(),
  duration: DurationSummarySchema.optional()
});

export const OptimizedHistoryArtifactSchema = z.object({
  schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
  project: z.object({ key: z.string().min(1), name: z.string().min(1) }),
  generatedAt: z.string().datetime(),
  retention: HistoryRetentionMetadataSchema,
  availability: z.enum(["unavailable", "insufficient", "available"]),
  runs: z.array(HistoricalRunSummarySchema).superRefine((runs, context) => {
    const ids = new Set<string>();
    for (const [index, run] of runs.entries()) {
      if (ids.has(run.id))
        context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate run ID" });
      ids.add(run.id);
    }
  }),
  manualExecutions: z
    .array(HistoricalManualExecutionSummarySchema)
    .superRefine((executions, context) => {
      const ids = new Set<string>();
      for (const [index, execution] of executions.entries()) {
        if (ids.has(execution.executionId))
          context.addIssue({
            code: "custom",
            path: [index, "executionId"],
            message: "Duplicate manual execution ID"
          });
        ids.add(execution.executionId);
      }
    }),
  cases: z.array(
    z.object({
      testCaseId: z.string().min(1),
      streams: z.array(StreamSummarySchema),
      automated: StreamSummarySchema.optional(),
      manual: z.array(StreamSummarySchema).optional(),
      aggregateCurrentStatus: z.string().optional(),
      samples: z.array(HistoricalSampleSchema).optional(),
      currentStatus: z.string().optional(),
      previousStatus: z.string().optional(),
      transition: HistoryTransitionSchema,
      sampleSize: z.number().int().nonnegative(),
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      passRate: z.number().min(0).max(100).optional(),
      consecutiveFailures: z.number().int().nonnegative(),
      lastPassedAt: z.string().datetime().optional(),
      lastFailedAt: z.string().datetime().optional(),
      identityConfidence: z.enum(["trusted", "generated-low", "conflicted"]),
      stability: z.enum([
        "insufficient-history",
        "stable",
        "historically-unstable",
        "identity-conflict"
      ]),
      passFailTransitions: z.number().int().nonnegative(),
      duration: DurationSummarySchema.optional()
    })
  ),
  trends: z.object({
    runCount: z.number().int().nonnegative(),
    oldestAt: z.string().datetime().optional(),
    newestAt: z.string().datetime().optional(),
    newFailures: z.number().int().nonnegative(),
    persistentFailures: z.number().int().nonnegative(),
    recovered: z.number().int().nonnegative(),
    removedOrMissing: z.number().int().nonnegative(),
    unstable: z.number().int().nonnegative(),
    slowRegressions: z.number().int().nonnegative()
  }),
  diagnostics: z.array(HistoryDiagnosticSchema)
});

function transition(
  current: HistoricalCaseSummary["samples"][number] | undefined,
  previousPresent: HistoricalCaseSummary["samples"][number] | undefined
): HistoryTransition {
  if (!current) return "not-executed";
  if (current.presence === "absent")
    return previousPresent ? "removed-or-missing" : "unchanged";
  if (current.status === "not-run") return "not-executed";
  const currentStatus = current.status;
  const previous = previousPresent?.status;
  const failing = (value: string | undefined) => value === "failed" || value === "broken";
  if (!previous) return failing(currentStatus) ? "first-observed-failing" : "new-case";
  if (failing(currentStatus) && failing(previous)) return "persistently-failing";
  if (failing(currentStatus) && !failing(previous)) return "newly-failing";
  if (currentStatus === "passed" && failing(previous)) return "recovered";
  if (currentStatus === "blocked" && previous === "blocked") return "still-blocked";
  if (currentStatus === "blocked") return "newly-blocked";
  return "unchanged";
}

export function deriveCaseHistory(
  store: ProjectHistoryStore,
  catalogueIds: string[] = [],
  options: HistoryOptions = {}
): HistoricalCaseSummary[] {
  const resolved = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  const byCase = new Map<string, HistoricalCaseSummary["samples"]>();
  const streams = new Map<string, HistoricalRunSummary[]>();
  for (const run of [...store.runs].reverse()) {
    const key = `${run.projectKey}\0${run.branch ?? ""}\0${run.environment ?? ""}`;
    streams.set(key, [...(streams.get(key) ?? []), run]);
  }
  for (const runs of streams.values()) {
    const knownIds = new Set(runs.flatMap((run) => run.caseResults.map((item) => item.testCaseId)));
    for (const run of runs) {
      const grouped = new Map<string, HistoricalRunSummary["caseResults"]>();
      for (const result of run.caseResults)
        grouped.set(result.testCaseId, [...(grouped.get(result.testCaseId) ?? []), result]);
      for (const testCaseId of knownIds) {
        const results = grouped.get(testCaseId) ?? [];
        if (!results.length) {
          (byCase.get(testCaseId) ?? byCase.set(testCaseId, []).get(testCaseId)!).push({
            executionId: run.id,
            type: "automated",
            at: run.completedAt ?? run.startedAt ?? run.reportedAt,
            status: "absent",
            presence: "absent",
            ...(run.branch ? { branch: run.branch } : {}),
            ...(run.environment ? { environment: run.environment } : {}),
            ...(run.release ? { release: run.release } : {}),
            ...(run.commit ? { commit: run.commit } : {}),
            ...(run.sourceReport ? { sourceReport: run.sourceReport } : {})
          });
          continue;
        }
      const durations = results
        .map((item) => item.durationMs)
        .filter((value): value is number => value !== undefined);
      (byCase.get(testCaseId) ?? byCase.set(testCaseId, []).get(testCaseId)!).push({
        executionId: run.id,
        type: "automated",
        at: run.completedAt ?? run.startedAt ?? run.reportedAt,
        status: aggregateStatus(results.map((item) => item.status)),
        presence: "present",
        ...(run.branch ? { branch: run.branch } : {}),
        ...(run.environment ? { environment: run.environment } : {}),
        ...(run.release ? { release: run.release } : {}),
        ...(run.commit ? { commit: run.commit } : {}),
        ...(durations.length
          ? { durationMs: durations.reduce((sum, value) => sum + value, 0) }
          : {}),
        implementationResults: results,
        ...(run.sourceReport ? { sourceReport: run.sourceReport } : {})
      });
      }
    }
  }
  for (const execution of [...store.manualExecutions].reverse())
    for (const result of execution.caseResults)
      (byCase.get(result.testCaseId) ??
        byCase.set(result.testCaseId, []).get(result.testCaseId)!).push({
        executionId: execution.executionId,
        type: "manual",
        at: execution.completedAt,
        status: result.status,
        presence: "present",
        ...(execution.environment ? { environment: execution.environment } : {}),
        ...(execution.release ? { release: execution.release } : {}),
        ...(execution.sourceReport ? { sourceReport: execution.sourceReport } : {})
      });
  const allIds = new Set([...catalogueIds, ...byCase.keys()]);
  return [...allIds].sort().map((testCaseId) => {
    const allSamples = (byCase.get(testCaseId) ?? []).sort(
      (a, b) => validTime(a.at) - validTime(b.at) || a.executionId.localeCompare(b.executionId)
    );
    const latest = allSamples.at(-1);
    const comparable = latest
      ? allSamples.filter(
          (sample) =>
            sample.type === latest.type &&
            sample.branch === latest.branch &&
            sample.environment === latest.environment
        )
      : [];
    const current = comparable.at(-1);
    const previous = [...comparable]
      .slice(0, -1)
      .reverse()
      .find((sample) => sample.presence === "present");
    const presentSamples = comparable.filter((sample) => sample.presence === "present");
    const passed = presentSamples.filter((sample) => sample.status === "passed").length;
    const failed = presentSamples.filter(
      (sample) => sample.status === "failed" || sample.status === "broken"
    ).length;
    const identity = [...comparable]
      .reverse()
      .find((sample) => sample.presence === "present")?.implementationResults?.[0]?.identity;
    const identityConfidence: HistoricalCaseSummary["identityConfidence"] = identity?.conflict
      ? "conflicted"
      : identity && (!identity.stable || identity.source === "generated")
        ? "generated-low"
        : "trusted";
    const passFail = presentSamples.filter((sample) =>
      ["passed", "failed", "broken"].includes(sample.status)
    );
    let passFailTransitions = 0;
    for (let index = 1; index < passFail.length; index++)
      if (
        (passFail[index]!.status === "passed") !==
        (passFail[index - 1]!.status === "passed")
      )
        passFailTransitions++;
    const durations = presentSamples
      .map((sample) => sample.durationMs)
      .filter((value): value is number => value !== undefined && value >= 0);
    const sorted = [...durations].sort((a, b) => a - b);
    const median = (values: number[]) =>
      values.length % 2
        ? values[Math.floor(values.length / 2)]!
        : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
    const latestDuration = durations.at(-1);
    const previousDuration = durations.at(-2);
    const absoluteChange =
      latestDuration !== undefined && previousDuration !== undefined
        ? latestDuration - previousDuration
        : undefined;
    const percentageChange =
      absoluteChange !== undefined && previousDuration
        ? (absoluteChange / previousDuration) * 100
        : undefined;
    const legacy = {
      testCaseId,
      samples: allSamples,
      ...(current?.presence === "present" ? { currentStatus: current.status } : {}),
      ...(previous ? { previousStatus: previous.status } : {}),
      transition: transition(current, previous),
      sampleSize: presentSamples.length,
      passed,
      failed,
      ...(presentSamples.length >= resolved.minimumSamples && identityConfidence !== "conflicted"
        ? { passRate: (passed / presentSamples.length) * 100 }
        : {}),
      consecutiveFailures: [...presentSamples]
        .reverse()
        .findIndex((sample) => !["failed", "broken"].includes(sample.status)) === -1
        ? failed
        : [...presentSamples]
            .reverse()
            .findIndex((sample) => !["failed", "broken"].includes(sample.status)),
      ...(() => {
        const value = [...presentSamples].reverse().find((sample) => sample.status === "passed")?.at;
        return value ? { lastPassedAt: value } : {};
      })(),
      ...(() => {
        const value = [...presentSamples]
          .reverse()
          .find((sample) => ["failed", "broken"].includes(sample.status))?.at;
        return value ? { lastFailedAt: value } : {};
      })(),
      identityConfidence,
      stability:
        identityConfidence === "conflicted"
          ? "identity-conflict"
          : presentSamples.length < resolved.minimumSamples
            ? "insufficient-history"
            : passFailTransitions >= resolved.flakyTransitionThreshold
              ? "historically-unstable"
              : "stable",
      passFailTransitions,
      ...(durations.length >= resolved.durationMinimumSamples && latestDuration !== undefined
        ? {
            duration: {
              latestMs: latestDuration,
              medianMs: median(sorted),
              ...(previousDuration !== undefined ? { previousMs: previousDuration } : {}),
              ...(absoluteChange !== undefined ? { absoluteChangeMs: absoluteChange } : {}),
              ...(percentageChange !== undefined ? { percentageChange } : {}),
              recentMedianMs: median(durations.slice(-5).sort((a, b) => a - b)),
              slowRegression:
                (absoluteChange ?? 0) >= resolved.durationMinimumIncreaseMs &&
                (percentageChange ?? 0) >= resolved.durationRegressionPercent
            }
          }
        : {})
    } satisfies Omit<
      HistoricalCaseSummary,
      "streams" | "automated" | "manual" | "aggregateCurrentStatus"
    >;
    const streamGroups = new Map<string, typeof allSamples>();
    for (const sample of allSamples) {
      const key = [sample.type, sample.branch ?? "", sample.environment ?? ""].join("\0");
      streamGroups.set(key, [...(streamGroups.get(key) ?? []), sample]);
    }
    const streamSummaries: HistoricalCaseStreamSummary[] = [...streamGroups.entries()]
      .map(([key, samples]) => {
        const streamCurrent = samples.at(-1);
        const streamPrevious = [...samples]
          .slice(0, -1)
          .reverse()
          .find((sample) => sample.presence === "present");
        const present = samples.filter((sample) => sample.presence === "present");
        const streamPassed = present.filter((sample) => sample.status === "passed").length;
        const streamFailed = present.filter((sample) =>
          ["failed", "broken"].includes(sample.status)
        ).length;
        const passFailSamples = present.filter((sample) =>
          ["passed", "failed", "broken"].includes(sample.status)
        );
        let transitions = 0;
        for (let index = 1; index < passFailSamples.length; index++)
          if (
            (passFailSamples[index]!.status === "passed") !==
            (passFailSamples[index - 1]!.status === "passed")
          )
            transitions++;
        const streamDurations = present
          .map((sample) => sample.durationMs)
          .filter((value): value is number => value !== undefined);
        const latestMs = streamDurations.at(-1);
        const previousMs = streamDurations.at(-2);
        const absoluteChangeMs =
          latestMs !== undefined && previousMs !== undefined ? latestMs - previousMs : undefined;
        const percentage =
          absoluteChangeMs !== undefined && previousMs
            ? (absoluteChangeMs / previousMs) * 100
            : undefined;
        const orderedDurations = [...streamDurations].sort((a, b) => a - b);
        const streamIdentity = [...present].reverse()[0]?.implementationResults?.[0]?.identity;
        const streamConfidence = streamIdentity?.conflict
          ? "conflicted"
          : streamIdentity && (!streamIdentity.stable || streamIdentity.source === "generated")
            ? "generated-low"
            : "trusted";
        return {
          key,
          type: streamCurrent?.type ?? "automated",
          ...(streamCurrent?.branch ? { branch: streamCurrent.branch } : {}),
          ...(streamCurrent?.environment ? { environment: streamCurrent.environment } : {}),
          samples,
          ...(streamCurrent?.presence === "present"
            ? { currentStatus: streamCurrent.status }
            : {}),
          ...(streamPrevious ? { previousStatus: streamPrevious.status } : {}),
          transition: transition(streamCurrent, streamPrevious),
          sampleSize: present.length,
          passed: streamPassed,
          failed: streamFailed,
          ...(present.length >= resolved.minimumSamples && streamConfidence !== "conflicted"
            ? { passRate: (streamPassed / present.length) * 100 }
            : {}),
          consecutiveFailures:
            [...present]
              .reverse()
              .findIndex((sample) => !["failed", "broken"].includes(sample.status)) === -1
              ? streamFailed
              : [...present]
                  .reverse()
                  .findIndex((sample) => !["failed", "broken"].includes(sample.status)),
          ...(() => {
            const value = [...present].reverse().find((sample) => sample.status === "passed")?.at;
            return value ? { lastPassedAt: value } : {};
          })(),
          ...(() => {
            const value = [...present]
              .reverse()
              .find((sample) => ["failed", "broken"].includes(sample.status))?.at;
            return value ? { lastFailedAt: value } : {};
          })(),
          stability:
            streamConfidence === "conflicted"
              ? "identity-conflict"
              : present.length < resolved.minimumSamples
                ? "insufficient-history"
                : transitions >= resolved.flakyTransitionThreshold
                  ? "historically-unstable"
                  : "stable",
          passFailTransitions: transitions,
          ...(streamDurations.length >= resolved.durationMinimumSamples && latestMs !== undefined
            ? {
                duration: {
                  latestMs,
                  medianMs: median(orderedDurations),
                  ...(previousMs !== undefined ? { previousMs } : {}),
                  ...(absoluteChangeMs !== undefined ? { absoluteChangeMs } : {}),
                  ...(percentage !== undefined ? { percentageChange: percentage } : {}),
                  recentMedianMs: median(streamDurations.slice(-5).sort((a, b) => a - b)),
                  slowRegression:
                    (absoluteChangeMs ?? 0) >= resolved.durationMinimumIncreaseMs &&
                    (percentage ?? 0) >= resolved.durationRegressionPercent
                }
              }
            : {})
        } satisfies HistoricalCaseStreamSummary;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    const automated = streamSummaries
      .filter((item) => item.type === "automated")
      .sort(
        (a, b) =>
          validTime(b.samples.at(-1)?.at) - validTime(a.samples.at(-1)?.at) ||
          a.key.localeCompare(b.key)
      )[0];
    const manual = streamSummaries.filter((item) => item.type === "manual");
    const aggregateCurrentStatus = aggregateStatus(
      streamSummaries
        .map((item) => item.currentStatus)
        .filter((status): status is string => status !== undefined)
    );
    const preferred = automated ?? [...manual].sort(
      (a, b) => validTime(b.samples.at(-1)?.at) - validTime(a.samples.at(-1)?.at)
    )[0];
    return {
      ...legacy,
      streams: streamSummaries,
      ...(automated ? { automated } : {}),
      ...(manual.length ? { manual } : {}),
      ...(streamSummaries.length ? { aggregateCurrentStatus } : {}),
      ...(preferred
        ? {
            ...(preferred.currentStatus ? { currentStatus: preferred.currentStatus } : {}),
            ...(preferred.previousStatus ? { previousStatus: preferred.previousStatus } : {}),
            transition: preferred.transition,
            sampleSize: preferred.sampleSize,
            passed: preferred.passed,
            failed: preferred.failed,
            ...(preferred.passRate !== undefined ? { passRate: preferred.passRate } : {}),
            consecutiveFailures: preferred.consecutiveFailures,
            ...(preferred.lastPassedAt ? { lastPassedAt: preferred.lastPassedAt } : {}),
            ...(preferred.lastFailedAt ? { lastFailedAt: preferred.lastFailedAt } : {}),
            stability: preferred.stability,
            passFailTransitions: preferred.passFailTransitions,
            ...(preferred.duration ? { duration: preferred.duration } : {})
          }
        : {})
    };
  });
}

export function deriveHistoryArtifact(store: ProjectHistoryStore, options: HistoryOptions = {}) {
  const cases = deriveCaseHistory(store, [], options);
  const counts = (name: HistoryTransition) =>
    cases.filter((item) => item.automated?.transition === name).length;
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    project: store.project,
    generatedAt: store.generatedAt,
    retention: store.retention,
    availability:
      store.runs.length === 0 ? "unavailable" : store.runs.length === 1 ? "insufficient" : "available",
    runs: store.runs,
    manualExecutions: store.manualExecutions,
    cases: cases.map(({ samples, automated, manual, ...item }) => {
      void samples;
      void automated;
      void manual;
      return item;
    }),
    trends: {
      runCount: store.runs.length,
      oldestAt: store.runs.at(-1)?.reportedAt,
      newestAt: store.runs[0]?.reportedAt,
      newFailures: counts("newly-failing") + counts("first-observed-failing"),
      persistentFailures: counts("persistently-failing"),
      recovered: counts("recovered"),
      removedOrMissing: counts("removed-or-missing"),
      unstable: cases.filter(
        (item) => item.automated?.stability === "historically-unstable"
      ).length,
      slowRegressions: cases.filter((item) => item.automated?.duration?.slowRegression).length
    },
    diagnostics: store.diagnostics
  };
}
