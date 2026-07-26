import type { NormalizedReport } from "../schema/report.js";
import { createHash } from "node:crypto";
import { stableId } from "../utils/hash.js";
import {
  HISTORY_SCHEMA_VERSION,
  HistoricalRunSummarySchema,
  HistoricalManualExecutionSummarySchema,
  ProjectHistoryStoreSchema,
  deriveAutomatedHistoryStatus,
  deriveManualHistoryStatus,
  deriveHistoricalStreamSemantics,
  historyReportedRange,
  type HistoricalRunSummary,
  type HistoricalManualExecutionSummary,
  type ProjectHistoryStore,
  type HistoryDiagnostic,
  type HistoricalCaseExecutionSample,
  type HistoricalCaseSummary as CanonicalHistoricalCaseSummary,
  type HistoricalCaseStreamSummary,
  type HistoricalTransition as HistoryTransition
} from "./artifact-schema.js";
export * from "./artifact-schema.js";

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

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)])
    );
  return value;
}

export const canonicalHistoricalContent = (value: unknown) =>
  JSON.stringify(canonicalValue(value));

export function historicalRunContentHash(run: HistoricalRunSummary) {
  const normalized = HistoricalRunSummarySchema.parse(run);
  return createHash("sha256")
    .update(canonicalHistoricalContent(normalized), "utf8")
    .digest("hex");
}

export function historicalManualContentHash(execution: HistoricalManualExecutionSummary) {
  const normalized = HistoricalManualExecutionSummarySchema.parse(execution);
  return createHash("sha256")
    .update(canonicalHistoricalContent(normalized), "utf8")
    .digest("hex");
}

function diagnosticIdentity(
  diagnostic: Omit<HistoryDiagnostic, "id" | "occurrences" | "firstObservedAt" | "lastObservedAt">
) {
  return stableId([
    diagnostic.severity,
    diagnostic.code,
    diagnostic.projectKey,
    diagnostic.runId,
    diagnostic.manualExecutionId,
    diagnostic.testCaseId,
    diagnostic.artifact,
    diagnostic.message
  ]);
}

function deduplicateDiagnostics(diagnostics: HistoryDiagnostic[]) {
  const byId = new Map<string, HistoryDiagnostic>();
  for (const diagnostic of diagnostics) {
    const id = diagnostic.id ?? diagnosticIdentity(diagnostic);
    if (!byId.has(id)) byId.set(id, { ...diagnostic, id });
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.severity.localeCompare(right.severity) ||
      left.code.localeCompare(right.code) ||
      (left.runId ?? left.manualExecutionId ?? left.testCaseId ?? "").localeCompare(
        right.runId ?? right.manualExecutionId ?? right.testCaseId ?? ""
      ) ||
      left.id!.localeCompare(right.id!)
  );
}

function aggregateStatus(
  statuses: string[]
): Exclude<HistoricalCaseExecutionSample["status"], "absent"> {
  const order = ["broken", "failed", "blocked", "not-run", "skipped", "passed", "unknown"];
  return (order.find((status) => statuses.includes(status)) ?? "unknown") as Exclude<
    HistoricalCaseExecutionSample["status"],
    "absent"
  >;
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
  const historicalCounts = {
    total: execution.caseResults.length,
    passed: execution.caseResults.filter((item) => item.status === "passed").length,
    failed: execution.caseResults.filter((item) => item.status === "failed").length,
    broken: execution.caseResults.filter((item) => item.status === "broken").length,
    blocked: execution.caseResults.filter((item) => item.status === "blocked").length,
    skipped: execution.caseResults.filter((item) => item.status === "skipped").length,
    notRun: execution.caseResults.filter((item) => item.status === "not-run").length,
    unknown: execution.caseResults.filter((item) => item.status === "unknown").length
  };
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
    status: deriveAutomatedHistoryStatus(historicalCounts),
    counts: historicalCounts,
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
      total:
        report.requirements.covered.length +
        report.requirements.missing.length +
        (report.releaseScope?.excludedRequirements?.length ?? 0)
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
      const status = deriveManualHistoryStatus(item.cases);
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

export interface HistoryMergeResult {
  store: ProjectHistoryStore;
  diagnostics: HistoryDiagnostic[];
  currentInputConflicts: HistoryDiagnostic[];
  changed: boolean;
}

export function mergeProjectHistoryResult(
  existing: ProjectHistoryStore | undefined,
  report: NormalizedReport,
  options: HistoryOptions = {},
  sourceReportUrl?: string
): HistoryMergeResult {
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
  const currentInputConflicts: HistoryDiagnostic[] = [];
  const runById = new Map(store.runs.map((run) => [run.id, run]));
  const current = deriveCurrentRunSummary(report, sourceReportUrl);
  if (current) {
    const duplicate = runById.get(current.id);
    if (duplicate && historicalRunContentHash(duplicate) !== historicalRunContentHash(current)) {
      const conflict: HistoryDiagnostic = {
        id: diagnosticIdentity({
          severity: "error",
          code: "HISTORY_RUN_CONFLICT",
          message: `Run ${current.id} already exists with conflicting immutable content.`,
          projectKey: project.key,
          runId: current.id
        }),
        severity: "error",
        code: "HISTORY_RUN_CONFLICT",
        message: `Run ${current.id} already exists with conflicting immutable content.`,
        projectKey: project.key,
        runId: current.id
      };
      diagnostics.push(conflict);
      currentInputConflicts.push(conflict);
    }
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
    else if (historicalManualContentHash(duplicate) !== historicalManualContentHash(item)) {
      const immutable = (value: HistoricalManualExecutionSummary) => ({
        executionId: value.executionId,
        projectKey: value.projectKey,
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        status: value.status,
        caseResults: value.caseResults
      });
      if (
        canonicalHistoricalContent(immutable(duplicate)) !==
        canonicalHistoricalContent(immutable(item))
      ) {
        const conflict: HistoryDiagnostic = {
          id: diagnosticIdentity({
            severity: "error",
            code: "HISTORY_MANUAL_CONFLICT",
            message: `Manual execution ${item.executionId} has conflicting result data.`,
            projectKey: project.key,
            manualExecutionId: item.executionId
          }),
          severity: "error",
          code: "HISTORY_MANUAL_CONFLICT",
          message: `Manual execution ${item.executionId} has conflicting result data.`,
          projectKey: project.key,
          manualExecutionId: item.executionId
        };
        diagnostics.push(conflict);
        currentInputConflicts.push(conflict);
      }
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
      id: diagnosticIdentity({
        severity: "information",
        code: "HISTORY_RETENTION_PRUNED",
        message: `Retention pruned ${prunedRuns} automated run(s) and ${prunedManualExecutions} manual execution(s).`,
        projectKey: project.key
      }),
      severity: "information",
      code: "HISTORY_RETENTION_PRUNED",
      message: `Retention pruned ${prunedRuns} automated run(s) and ${prunedManualExecutions} manual execution(s).`,
      projectKey: project.key
    });
  const merged = ProjectHistoryStoreSchema.parse({
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
    diagnostics: deduplicateDiagnostics(diagnostics)
  });
  return {
    store: merged,
    diagnostics: merged.diagnostics,
    currentInputConflicts: deduplicateDiagnostics(currentInputConflicts),
    changed: canonicalHistoricalContent(store) !== canonicalHistoricalContent(merged)
  };
}

export function mergeProjectHistory(
  existing: ProjectHistoryStore | undefined,
  report: NormalizedReport,
  options: HistoryOptions = {},
  sourceReportUrl?: string
): ProjectHistoryStore {
  return mergeProjectHistoryResult(existing, report, options, sourceReportUrl).store;
}

type HistoricalCaseSummary = Omit<
  CanonicalHistoricalCaseSummary,
  "samples" | "automated" | "manual"
> & {
  samples: HistoricalCaseExecutionSample[];
  automated?: HistoricalCaseStreamSummary;
  manual?: HistoricalCaseStreamSummary[];
};

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
      ...(current?.presence === "present"
        ? {
            currentStatus: current.status as Exclude<
              HistoricalCaseExecutionSample["status"],
              "absent"
            >
          }
        : {}),
      ...(previous
        ? {
            previousStatus: previous.status as Exclude<
              HistoricalCaseExecutionSample["status"],
              "absent"
            >
          }
        : {}),
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
        const present = samples.filter((sample) => sample.presence === "present");
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
          ...deriveHistoricalStreamSemantics(samples, resolved, streamConfidence)
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
        .filter(
          (
            status
          ): status is Exclude<HistoricalCaseExecutionSample["status"], "absent"> =>
            status !== undefined
        )
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
  const resolved = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  const cases = deriveCaseHistory(store, [], options);
  const counts = (name: HistoryTransition) =>
    cases.filter((item) => item.automated?.transition === name).length;
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    project: store.project,
    generatedAt: store.generatedAt,
    retention: store.retention,
    thresholds: {
      minimumSamples: resolved.minimumSamples,
      flakyTransitionThreshold: resolved.flakyTransitionThreshold,
      durationMinimumSamples: resolved.durationMinimumSamples,
      durationRegressionPercent: resolved.durationRegressionPercent,
      durationMinimumIncreaseMs: resolved.durationMinimumIncreaseMs
    },
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
      ...historyReportedRange(store.runs),
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
