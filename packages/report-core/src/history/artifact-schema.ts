import { z } from "zod";

export const HISTORY_SCHEMA_VERSION = "1.0";

export const HistoricalResultStatusSchema = z.enum([
  "passed",
  "failed",
  "broken",
  "blocked",
  "not-run",
  "skipped",
  "unknown"
]);
export const HistoricalSampleStatusSchema = z.enum([
  ...HistoricalResultStatusSchema.options,
  "absent"
]);
export const HistoryTransitionSchema = z.enum([
  "newly-failing",
  "first-observed-failing",
  "persistently-failing",
  "recovered",
  "still-blocked",
  "newly-blocked",
  "not-executed",
  "new-case",
  "removed-or-missing",
  "unchanged",
  "unknown"
]);
export const HistoricalStabilitySchema = z.enum([
  "insufficient-history",
  "stable",
  "historically-unstable",
  "in-run-flaky",
  "identity-conflict",
  "unavailable"
]);
export const HistoricalIdentityConfidenceSchema = z.enum([
  "trusted",
  "generated-low",
  "conflicted"
]);
export const HistoryDiagnosticSeveritySchema = z.enum([
  "error",
  "warning",
  "information"
]);

const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "historical links must use HTTP or HTTPS"
  });
const SourceReportSchema = z
  .object({ url: HttpUrlSchema.optional(), evidenceUrl: HttpUrlSchema.optional() })
  .strict();
const DateTimeSchema = z.string().datetime();

function uniqueBy<T>(
  values: T[],
  key: (value: T) => string | undefined,
  label: string,
  context: z.RefinementCtx
) {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const identity = key(value);
    if (identity === undefined) continue;
    if (seen.has(identity))
      context.addIssue({
        code: "custom",
        path: [index],
        message: `Duplicate ${label}: ${identity}`
      });
    seen.add(identity);
  }
}

const failedStatuses = new Set(["failed", "broken"]);

function validateDerivedSampleSummary(
  summary: {
    samples: Array<{ presence: "present" | "absent"; status: string; at: string }>;
    sampleSize: number;
    passed: number;
    failed: number;
    passRate?: number | undefined;
    consecutiveFailures: number;
    lastPassedAt?: string | undefined;
    lastFailedAt?: string | undefined;
  },
  context: z.RefinementCtx
) {
  const present = summary.samples.filter((sample) => sample.presence === "present");
  const passed = present.filter((sample) => sample.status === "passed").length;
  const failed = present.filter((sample) => failedStatuses.has(sample.status)).length;
  let consecutiveFailures = 0;
  for (const sample of [...present].reverse()) {
    if (!failedStatuses.has(sample.status)) break;
    consecutiveFailures++;
  }
  const lastPassedAt = [...present].reverse().find((sample) => sample.status === "passed")?.at;
  const lastFailedAt = [...present]
    .reverse()
    .find((sample) => failedStatuses.has(sample.status))?.at;
  const derived: Array<[keyof typeof summary, unknown, unknown]> = [
    ["sampleSize", summary.sampleSize, present.length],
    ["passed", summary.passed, passed],
    ["failed", summary.failed, failed],
    ["consecutiveFailures", summary.consecutiveFailures, consecutiveFailures]
  ];
  for (const [field, actual, expected] of derived)
    if (actual !== expected)
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${String(field)} ${String(actual)} does not match derived value ${String(expected)}`
      });
  for (const [field, actual, expected] of [
    ["lastPassedAt", summary.lastPassedAt, lastPassedAt],
    ["lastFailedAt", summary.lastFailedAt, lastFailedAt]
  ] as const)
    if (actual !== undefined && actual !== expected)
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} does not match the latest relevant sample timestamp`
      });
  if (
    summary.passRate !== undefined &&
    Math.abs(summary.passRate - (present.length ? (passed / present.length) * 100 : 0)) >
      0.000_001
  )
    context.addIssue({
      code: "custom",
      path: ["passRate"],
      message: "Pass rate does not match passed samples divided by comparable present samples"
    });
}

export const HistoryDiagnosticSchema = z
  .object({
    id: z.string().min(1).optional(),
    severity: HistoryDiagnosticSeveritySchema,
    code: z.string().min(1),
    message: z.string().min(1),
    artifact: z.string().optional(),
    projectKey: z.string().optional(),
    runId: z.string().optional(),
    manualExecutionId: z.string().optional(),
    testCaseId: z.string().optional(),
    firstObservedAt: DateTimeSchema.optional(),
    lastObservedAt: DateTimeSchema.optional(),
    occurrences: z.number().int().positive().optional()
  })
  .strict()
  .superRefine((diagnostic, context) => {
    if (
      diagnostic.firstObservedAt &&
      diagnostic.lastObservedAt &&
      Date.parse(diagnostic.lastObservedAt) < Date.parse(diagnostic.firstObservedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["lastObservedAt"],
        message: "Diagnostic lastObservedAt must not precede firstObservedAt"
      });
  });

export const HistoricalCaseResultSnapshotSchema = z
  .object({
    testCaseId: z.string().min(1),
    implementationId: z.string().min(1).optional(),
    status: HistoricalResultStatusSchema,
    durationMs: z.number().finite().nonnegative().optional(),
    attemptCount: z.number().int().positive().optional(),
    flakyInRun: z.boolean().optional(),
    identity: z
      .object({
        source: z.string().min(1),
        stable: z.boolean(),
        conflict: z.boolean()
      })
      .strict()
  })
  .strict();

export const HistoricalCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    broken: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    notRun: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((counts, context) => {
    const sum =
      counts.passed +
      counts.failed +
      counts.broken +
      counts.blocked +
      counts.skipped +
      counts.notRun +
      counts.unknown;
    if (sum !== counts.total)
      context.addIssue({
        code: "custom",
        path: ["total"],
        message: `Count total ${counts.total} does not equal category sum ${sum}`
      });
  });

const TimedExecutionSchema = z
  .object({
    startedAt: DateTimeSchema.optional(),
    completedAt: DateTimeSchema.optional()
  })
  .superRefine((execution, context) => {
    if (
      execution.startedAt &&
      execution.completedAt &&
      Date.parse(execution.completedAt) < Date.parse(execution.startedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt must not precede startedAt"
      });
  });

export const HistoricalRunSummarySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("automated"),
    projectKey: z.string().min(1),
    release: z.string().optional(),
    branch: z.string().optional(),
    environment: z.string().optional(),
    commit: z.string().optional(),
    workflowRun: z.string().optional(),
    workflowAttempt: z.number().int().positive().optional(),
    reportedAt: DateTimeSchema,
    startedAt: DateTimeSchema.optional(),
    completedAt: DateTimeSchema.optional(),
    wallClockDurationMs: z.number().finite().nonnegative().optional(),
    testDurationSumMs: z.number().finite().nonnegative().optional(),
    status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]),
    counts: HistoricalCountsSchema,
    qualityGate: z
      .object({
        status: z.enum(["passed", "failed", "skipped", "not_evaluated"]),
        profile: z.string().optional()
      })
      .strict()
      .optional(),
    readiness: z
      .object({
        status: z.enum([
          "ready",
          "ready-with-accepted-risks",
          "warning",
          "blocked",
          "incomplete"
        ]),
        blockers: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        acceptedRisks: z.number().int().nonnegative()
      })
      .strict()
      .optional(),
    requirements: z
      .object({
        covered: z.number().int().nonnegative(),
        uncovered: z.number().int().nonnegative(),
        excluded: z.number().int().nonnegative(),
        total: z.number().int().nonnegative()
      })
      .strict()
      .superRefine((requirements, context) => {
        if (
          requirements.covered + requirements.uncovered + requirements.excluded !==
          requirements.total
        )
          context.addIssue({
            code: "custom",
            path: ["total"],
            message: "Requirement total does not equal covered, uncovered, and excluded"
          });
      })
      .optional(),
    coverage: z
      .object({
        line: z.number().finite().min(0).max(100).optional(),
        branch: z.number().finite().min(0).max(100).optional(),
        function: z.number().finite().min(0).max(100).optional(),
        statement: z.number().finite().min(0).max(100).optional()
      })
      .strict()
      .optional(),
    security: z
      .object({
        blockers: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        accepted: z.number().int().nonnegative()
      })
      .strict()
      .optional(),
    caseResults: z.array(HistoricalCaseResultSnapshotSchema),
    sourceReport: SourceReportSchema.optional()
  })
  .strict()
  .and(TimedExecutionSchema)
  .superRefine((run, context) => {
    if (run.counts.total !== run.caseResults.length)
      context.addIssue({
        code: "custom",
        path: ["counts", "total"],
        message: `Run count total ${run.counts.total} does not equal case result snapshot count ${run.caseResults.length}`
      });
    uniqueBy(
      run.caseResults,
      (result) => `${result.testCaseId}\0${result.implementationId ?? ""}`,
      "case implementation result",
      context
    );
  });

export const HistoricalManualExecutionSummarySchema = z
  .object({
    executionId: z.string().min(1),
    projectKey: z.string().min(1),
    release: z.string().optional(),
    environment: z.string().optional(),
    testedBuild: z.string().optional(),
    tester: z.string().optional(),
    startedAt: DateTimeSchema,
    completedAt: DateTimeSchema,
    status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]),
    caseResults: z.array(
      z
        .object({
          testCaseId: z.string().min(1),
          status: z.enum(["passed", "failed", "blocked", "not-run", "skipped", "unknown"])
        })
        .strict()
    ),
    sourceReport: SourceReportSchema.optional()
  })
  .strict()
  .superRefine((execution, context) => {
    if (Date.parse(execution.completedAt) < Date.parse(execution.startedAt))
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt must not precede startedAt"
      });
    uniqueBy(
      execution.caseResults,
      (result) => result.testCaseId,
      "manual case result",
      context
    );
  });

export const HistoryRetentionMetadataSchema = z
  .object({
    maxRuns: z.number().int().positive(),
    maxAgeDays: z.number().int().positive(),
    maxManualExecutions: z.number().int().nonnegative(),
    prunedRuns: z.number().int().nonnegative().default(0),
    prunedManualExecutions: z.number().int().nonnegative().default(0)
  })
  .strict();

export const ProjectHistoryStoreSchema = z
  .object({
    schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
    project: z.object({ key: z.string().min(1), name: z.string().min(1) }).strict(),
    generatedAt: DateTimeSchema,
    retention: HistoryRetentionMetadataSchema,
    runs: z.array(HistoricalRunSummarySchema),
    manualExecutions: z.array(HistoricalManualExecutionSummarySchema),
    diagnostics: z.array(HistoryDiagnosticSchema).default([])
  })
  .strict();

export const HistoricalSampleSchema = z
  .object({
    executionId: z.string().min(1),
    type: z.enum(["automated", "manual"]),
    at: DateTimeSchema,
    status: HistoricalSampleStatusSchema,
    presence: z.enum(["present", "absent"]),
    branch: z.string().optional(),
    environment: z.string().optional(),
    release: z.string().optional(),
    commit: z.string().optional(),
    durationMs: z.number().finite().nonnegative().optional(),
    implementationResults: z.array(HistoricalCaseResultSnapshotSchema).optional(),
    sourceReport: SourceReportSchema.optional()
  })
  .strict()
  .superRefine((sample, context) => {
    if (sample.presence === "present" && sample.status === "absent")
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "A present sample cannot have absent status"
      });
    if (sample.presence === "absent" && sample.status !== "absent")
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "An absent sample must have absent status"
      });
    if (
      sample.presence === "absent" &&
      (sample.durationMs !== undefined || sample.implementationResults !== undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["presence"],
        message: "An absent sample cannot contain duration or implementation results"
      });
  });

export const HistoricalDurationSummarySchema = z
  .object({
    latestMs: z.number().finite().nonnegative(),
    medianMs: z.number().finite().nonnegative(),
    previousMs: z.number().finite().nonnegative().optional(),
    absoluteChangeMs: z.number().finite().optional(),
    percentageChange: z.number().finite().optional(),
    recentMedianMs: z.number().finite().nonnegative(),
    slowRegression: z.boolean()
  })
  .strict();

export const HistoricalCaseStreamSummarySchema = z
  .object({
    key: z.string().min(1),
    type: z.enum(["automated", "manual"]),
    branch: z.string().optional(),
    environment: z.string().optional(),
    samples: z.array(HistoricalSampleSchema),
    currentStatus: HistoricalResultStatusSchema.optional(),
    previousStatus: HistoricalResultStatusSchema.optional(),
    transition: HistoryTransitionSchema,
    sampleSize: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    passRate: z.number().finite().min(0).max(100).optional(),
    consecutiveFailures: z.number().int().nonnegative(),
    lastPassedAt: DateTimeSchema.optional(),
    lastFailedAt: DateTimeSchema.optional(),
    stability: HistoricalStabilitySchema,
    passFailTransitions: z.number().int().nonnegative(),
    duration: HistoricalDurationSummarySchema.optional()
  })
  .strict()
  .superRefine((stream, context) => {
    uniqueBy(
      stream.samples,
      (sample) => `${sample.type}\0${sample.executionId}`,
      "stream sample execution ID",
      context
    );
    validateDerivedSampleSummary(stream, context);
  });

export const HistoricalCaseSummarySchema = z
  .object({
    testCaseId: z.string().min(1),
    streams: z.array(HistoricalCaseStreamSummarySchema),
    automated: HistoricalCaseStreamSummarySchema.optional(),
    manual: z.array(HistoricalCaseStreamSummarySchema).optional(),
    samples: z.array(HistoricalSampleSchema).optional(),
    aggregateCurrentStatus: HistoricalResultStatusSchema.optional(),
    currentStatus: HistoricalResultStatusSchema.optional(),
    previousStatus: HistoricalResultStatusSchema.optional(),
    transition: HistoryTransitionSchema,
    sampleSize: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    passRate: z.number().finite().min(0).max(100).optional(),
    consecutiveFailures: z.number().int().nonnegative(),
    lastPassedAt: DateTimeSchema.optional(),
    lastFailedAt: DateTimeSchema.optional(),
    identityConfidence: HistoricalIdentityConfidenceSchema,
    stability: HistoricalStabilitySchema,
    passFailTransitions: z.number().int().nonnegative(),
    duration: HistoricalDurationSummarySchema.optional()
  })
  .strict()
  .superRefine((summary, context) => {
    uniqueBy(summary.streams, (stream) => stream.key, "case stream key", context);
    const automated = summary.streams
      .filter((stream) => stream.type === "automated")
      .sort(
        (left, right) =>
          Date.parse(right.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") -
            Date.parse(left.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") ||
          left.key.localeCompare(right.key)
      )[0];
    const preferred =
      automated ??
      [...summary.streams].sort(
        (left, right) =>
          Date.parse(right.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") -
            Date.parse(left.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") ||
          left.key.localeCompare(right.key)
      )[0];
    if (preferred) {
      const fields = [
        "currentStatus",
        "previousStatus",
        "transition",
        "sampleSize",
        "passed",
        "failed",
        "passRate",
        "consecutiveFailures",
        "lastPassedAt",
        "lastFailedAt",
        "stability",
        "passFailTransitions"
      ] as const;
      for (const field of fields)
        if (summary[field] !== preferred[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} does not agree with the preferred comparison stream`
          });
      if (
        summary.duration !== undefined &&
        JSON.stringify(summary.duration) !== JSON.stringify(preferred.duration)
      )
        context.addIssue({
          code: "custom",
          path: ["duration"],
          message: "duration does not agree with the preferred comparison stream"
        });
    }
    const aggregateCurrentStatus = [
      "broken",
      "failed",
      "blocked",
      "not-run",
      "skipped",
      "passed",
      "unknown"
    ].find((status) => summary.streams.some((stream) => stream.currentStatus === status));
    if (
      summary.aggregateCurrentStatus !== undefined &&
      summary.aggregateCurrentStatus !== aggregateCurrentStatus
    )
      context.addIssue({
        code: "custom",
        path: ["aggregateCurrentStatus"],
        message: "Aggregate current status does not agree with current stream statuses"
      });
    if (
      summary.identityConfidence === "conflicted" &&
      (summary.stability !== "identity-conflict" || summary.passRate !== undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["identityConfidence"],
        message: "Identity-conflicted cases cannot expose trusted stability or pass rate"
      });
  });

export const OptimizedHistoryArtifactSchema = z
  .object({
    schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
    project: z.object({ key: z.string().min(1), name: z.string().min(1) }).strict(),
    generatedAt: DateTimeSchema,
    retention: HistoryRetentionMetadataSchema,
    availability: z.enum(["unavailable", "insufficient", "available"]),
    runs: z.array(HistoricalRunSummarySchema),
    manualExecutions: z.array(HistoricalManualExecutionSummarySchema),
    cases: z.array(HistoricalCaseSummarySchema),
    trends: z
      .object({
        runCount: z.number().int().nonnegative(),
        oldestAt: DateTimeSchema.optional(),
        newestAt: DateTimeSchema.optional(),
        newFailures: z.number().int().nonnegative(),
        persistentFailures: z.number().int().nonnegative(),
        recovered: z.number().int().nonnegative(),
        removedOrMissing: z.number().int().nonnegative(),
        unstable: z.number().int().nonnegative(),
        slowRegressions: z.number().int().nonnegative()
      })
      .strict(),
    diagnostics: z.array(HistoryDiagnosticSchema)
  })
  .strict()
  .superRefine((artifact, context) => {
    uniqueBy(artifact.runs, (run) => run.id, "run ID", context);
    uniqueBy(
      artifact.manualExecutions,
      (execution) => execution.executionId,
      "manual execution ID",
      context
    );
    uniqueBy(artifact.cases, (summary) => summary.testCaseId, "case ID", context);
    uniqueBy(artifact.diagnostics, (diagnostic) => diagnostic.id, "diagnostic ID", context);
    if (artifact.trends.runCount !== artifact.runs.length)
      context.addIssue({
        code: "custom",
        path: ["trends", "runCount"],
        message: `Trend run count ${artifact.trends.runCount} does not equal retained run count ${artifact.runs.length}`
      });
    const reportedTimes = artifact.runs.map((run) => run.reportedAt).sort();
    if (
      artifact.trends.oldestAt !== undefined &&
      artifact.trends.oldestAt !== reportedTimes.at(0)
    )
      context.addIssue({
        code: "custom",
        path: ["trends", "oldestAt"],
        message: "Oldest trend timestamp does not match retained runs"
      });
    if (
      artifact.trends.newestAt !== undefined &&
      artifact.trends.newestAt !== reportedTimes.at(-1)
    )
      context.addIssue({
        code: "custom",
        path: ["trends", "newestAt"],
        message: "Newest trend timestamp does not match retained runs"
      });
    const caseCount = artifact.cases.length;
    for (const field of [
      "newFailures",
      "persistentFailures",
      "recovered",
      "removedOrMissing",
      "unstable",
      "slowRegressions"
    ] as const)
      if (artifact.trends[field] > caseCount)
        context.addIssue({
          code: "custom",
          path: ["trends", field],
          message: `Trend metric ${field} exceeds retained logical case count ${caseCount}`
        });
  });

export type HistoricalRunSummary = z.infer<typeof HistoricalRunSummarySchema>;
export type HistoricalManualExecutionSummary = z.infer<
  typeof HistoricalManualExecutionSummarySchema
>;
export type ProjectHistoryStore = z.infer<typeof ProjectHistoryStoreSchema>;
export type HistoryDiagnostic = z.infer<typeof HistoryDiagnosticSchema>;
export type HistoricalCaseExecutionSample = z.infer<typeof HistoricalSampleSchema>;
export type HistoricalCaseStreamSummary = z.infer<
  typeof HistoricalCaseStreamSummarySchema
>;
export type HistoricalCaseSummary = z.infer<typeof HistoricalCaseSummarySchema>;
export type HistoricalTransition = z.infer<typeof HistoryTransitionSchema>;
export type HistoricalStabilityState = z.infer<typeof HistoricalStabilitySchema>;
export type OptimizedHistoryArtifact = z.infer<typeof OptimizedHistoryArtifactSchema>;

export function parseOptimizedHistoryArtifact(input: unknown): OptimizedHistoryArtifact {
  return OptimizedHistoryArtifactSchema.parse(input);
}

export function safeParseOptimizedHistoryArtifact(input: unknown) {
  return OptimizedHistoryArtifactSchema.safeParse(input);
}
