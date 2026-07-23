import { z } from "zod";

import type { NormalizedReport } from "../schema/report.js";
import { stableId } from "../utils/hash.js";

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
  sourceReport: z.object({ url: z.string().optional(), evidenceUrl: z.string().optional() }).optional()
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
  sourceReport: z.object({ url: z.string().optional(), evidenceUrl: z.string().optional() }).optional()
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
  const workflowAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const id =
    report.metadata.runId ??
    (report.metadata.workflowRun
      ? `${report.metadata.workflowRun}${Number.isInteger(workflowAttempt) && workflowAttempt > 0 ? `-${workflowAttempt}` : ""}`
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
    ...(Number.isInteger(workflowAttempt) && workflowAttempt > 0 ? { workflowAttempt } : {}),
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
  samples: Array<{
    executionId: string;
    type: "automated" | "manual";
    at: string;
    status: string;
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

function transition(current: string | undefined, previous: string | undefined): HistoryTransition {
  if (!current) return previous ? "removed-or-missing" : "not-executed";
  const failing = (value: string | undefined) => value === "failed" || value === "broken";
  if (!previous) return failing(current) ? "first-observed-failing" : "new-case";
  if (failing(current) && failing(previous)) return "persistently-failing";
  if (failing(current) && !failing(previous)) return "newly-failing";
  if (current === "passed" && failing(previous)) return "recovered";
  if (current === "blocked" && previous === "blocked") return "still-blocked";
  if (current === "blocked") return "newly-blocked";
  return "unchanged";
}

export function deriveCaseHistory(
  store: ProjectHistoryStore,
  catalogueIds: string[] = [],
  options: HistoryOptions = {}
): HistoricalCaseSummary[] {
  const resolved = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  const byCase = new Map<string, HistoricalCaseSummary["samples"]>();
  for (const run of [...store.runs].reverse()) {
    const grouped = new Map<string, HistoricalRunSummary["caseResults"]>();
    for (const result of run.caseResults)
      grouped.set(result.testCaseId, [...(grouped.get(result.testCaseId) ?? []), result]);
    for (const [testCaseId, results] of grouped) {
      const durations = results
        .map((item) => item.durationMs)
        .filter((value): value is number => value !== undefined);
      (byCase.get(testCaseId) ?? byCase.set(testCaseId, []).get(testCaseId)!).push({
        executionId: run.id,
        type: "automated",
        at: run.completedAt ?? run.startedAt ?? run.reportedAt,
        status: aggregateStatus(results.map((item) => item.status)),
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
  for (const execution of [...store.manualExecutions].reverse())
    for (const result of execution.caseResults)
      (byCase.get(result.testCaseId) ??
        byCase.set(result.testCaseId, []).get(result.testCaseId)!).push({
        executionId: execution.executionId,
        type: "manual",
        at: execution.completedAt,
        status: result.status,
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
    const previous = comparable.at(-2);
    const passed = comparable.filter((sample) => sample.status === "passed").length;
    const failed = comparable.filter(
      (sample) => sample.status === "failed" || sample.status === "broken"
    ).length;
    const identity = latest?.implementationResults?.[0]?.identity;
    const identityConfidence = identity?.conflict
      ? "conflicted"
      : identity && (!identity.stable || identity.source === "generated")
        ? "generated-low"
        : "trusted";
    const passFail = comparable.filter((sample) =>
      ["passed", "failed", "broken"].includes(sample.status)
    );
    let passFailTransitions = 0;
    for (let index = 1; index < passFail.length; index++)
      if (
        (passFail[index]!.status === "passed") !==
        (passFail[index - 1]!.status === "passed")
      )
        passFailTransitions++;
    const durations = comparable
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
    return {
      testCaseId,
      samples: allSamples,
      ...(current ? { currentStatus: current.status } : {}),
      ...(previous ? { previousStatus: previous.status } : {}),
      transition: transition(current?.status, previous?.status),
      sampleSize: comparable.length,
      passed,
      failed,
      ...(comparable.length >= resolved.minimumSamples && identityConfidence !== "conflicted"
        ? { passRate: (passed / comparable.length) * 100 }
        : {}),
      consecutiveFailures: [...comparable]
        .reverse()
        .findIndex((sample) => !["failed", "broken"].includes(sample.status)) === -1
        ? failed
        : [...comparable]
            .reverse()
            .findIndex((sample) => !["failed", "broken"].includes(sample.status)),
      ...(() => {
        const value = [...comparable].reverse().find((sample) => sample.status === "passed")?.at;
        return value ? { lastPassedAt: value } : {};
      })(),
      ...(() => {
        const value = [...comparable]
          .reverse()
          .find((sample) => ["failed", "broken"].includes(sample.status))?.at;
        return value ? { lastFailedAt: value } : {};
      })(),
      identityConfidence,
      stability:
        identityConfidence === "conflicted"
          ? "identity-conflict"
          : comparable.length < resolved.minimumSamples
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
    };
  });
}

export function deriveHistoryArtifact(store: ProjectHistoryStore, options: HistoryOptions = {}) {
  const cases = deriveCaseHistory(store, [], options);
  const counts = (name: HistoryTransition) =>
    cases.filter((item) => item.transition === name).length;
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    project: store.project,
    generatedAt: store.generatedAt,
    retention: store.retention,
    availability:
      store.runs.length === 0 ? "unavailable" : store.runs.length === 1 ? "insufficient" : "available",
    runs: store.runs,
    manualExecutions: store.manualExecutions,
    cases,
    trends: {
      runCount: store.runs.length,
      oldestAt: store.runs.at(-1)?.reportedAt,
      newestAt: store.runs[0]?.reportedAt,
      newFailures: counts("newly-failing") + counts("first-observed-failing"),
      persistentFailures: counts("persistently-failing"),
      recovered: counts("recovered"),
      unstable: cases.filter((item) => item.stability === "historically-unstable").length,
      slowRegressions: cases.filter((item) => item.duration?.slowRegression).length
    },
    diagnostics: store.diagnostics
  };
}
