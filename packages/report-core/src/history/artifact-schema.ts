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

export function deriveAutomatedHistoryStatus(counts: {
  total: number;
  passed: number;
  failed: number;
  broken: number;
  blocked: number;
  skipped: number;
  notRun: number;
  unknown: number;
}) {
  if (counts.failed > 0 || counts.broken > 0) return "failed" as const;
  if (counts.blocked > 0) return "blocked" as const;
  if (counts.unknown > 0) return "unknown" as const;
  if (counts.passed > 0 && counts.passed + counts.skipped === counts.total)
    return "passed" as const;
  if (counts.total === 0 || counts.skipped + counts.notRun === counts.total)
    return "incomplete" as const;
  return "unknown" as const;
}

export function deriveManualHistoryStatus(
  results: Array<{ status: string }>
) {
  const statuses = results.map((result) => result.status);
  if (statuses.includes("failed")) return "failed" as const;
  if (statuses.includes("blocked")) return "blocked" as const;
  if (statuses.includes("unknown")) return "unknown" as const;
  if (statuses.length > 0 && statuses.every((status) => status === "passed"))
    return "passed" as const;
  return "incomplete" as const;
}

export function reportedTimestamp(run: { reportedAt: string }) {
  return Date.parse(run.reportedAt);
}

export function historyReportedRange(
  runs: Array<{ id: string; reportedAt: string }>
): { oldestAt?: string; newestAt?: string } {
  const ordered = [...runs].sort(
    (left, right) =>
      reportedTimestamp(left) - reportedTimestamp(right) ||
      left.id.localeCompare(right.id)
  );
  return {
    ...(ordered[0] ? { oldestAt: ordered[0].reportedAt } : {}),
    ...(ordered.at(-1) ? { newestAt: ordered.at(-1)!.reportedAt } : {})
  };
}

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
    if (run.status !== deriveAutomatedHistoryStatus(run.counts))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: `Automated run status ${run.status} contradicts result counts`
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
    if (execution.status !== deriveManualHistoryStatus(execution.caseResults))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: `Manual execution status ${execution.status} contradicts case results`
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

export const HistoricalThresholdsSchema = z
  .object({
    minimumSamples: z.number().int().positive(),
    flakyTransitionThreshold: z.number().int().nonnegative(),
    durationMinimumSamples: z.number().int().positive(),
    durationRegressionPercent: z.number().finite().positive(),
    durationMinimumIncreaseMs: z.number().finite().nonnegative()
  })
  .strict();

export const DEFAULT_HISTORICAL_THRESHOLDS = {
  minimumSamples: 5,
  flakyTransitionThreshold: 2,
  durationMinimumSamples: 3,
  durationRegressionPercent: 30,
  durationMinimumIncreaseMs: 500
} satisfies z.infer<typeof HistoricalThresholdsSchema>;

export function resolveHistoricalThresholds(
  thresholds?: Partial<z.infer<typeof HistoricalThresholdsSchema>>
): z.infer<typeof HistoricalThresholdsSchema> {
  return HistoricalThresholdsSchema.parse({
    minimumSamples:
      thresholds?.minimumSamples ?? DEFAULT_HISTORICAL_THRESHOLDS.minimumSamples,
    flakyTransitionThreshold:
      thresholds?.flakyTransitionThreshold ??
      DEFAULT_HISTORICAL_THRESHOLDS.flakyTransitionThreshold,
    durationMinimumSamples:
      thresholds?.durationMinimumSamples ??
      DEFAULT_HISTORICAL_THRESHOLDS.durationMinimumSamples,
    durationRegressionPercent:
      thresholds?.durationRegressionPercent ??
      DEFAULT_HISTORICAL_THRESHOLDS.durationRegressionPercent,
    durationMinimumIncreaseMs:
      thresholds?.durationMinimumIncreaseMs ??
      DEFAULT_HISTORICAL_THRESHOLDS.durationMinimumIncreaseMs
  });
}

export function normalizeHistoricalStreamDimension(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function historicalStreamKey(input: {
  testCaseId: string;
  type: "automated" | "manual";
  branch?: string;
  environment?: string;
}) {
  return [
    input.testCaseId,
    input.type,
    normalizeHistoricalStreamDimension(input.branch) ?? "",
    normalizeHistoricalStreamDimension(input.environment) ?? ""
  ].join("\0");
}

export function compareHistoricalSamples(
  left: z.infer<typeof HistoricalSampleSchema>,
  right: z.infer<typeof HistoricalSampleSchema>
) {
  return (
    Date.parse(left.at) - Date.parse(right.at) ||
    left.executionId.localeCompare(right.executionId)
  );
}

export function deriveHistoricalStreamIdentityConfidence(
  samples: Array<z.infer<typeof HistoricalSampleSchema>>
): z.infer<typeof HistoricalIdentityConfidenceSchema> {
  const identities = samples.flatMap((sample) =>
    sample.implementationResults?.map((result) => result.identity) ?? []
  );
  if (identities.some((identity) => identity.conflict)) return "conflicted";
  if (
    identities.some(
      (identity) => !identity.stable || identity.source === "generated"
    )
  )
    return "generated-low";
  return "trusted";
}

function historicalTransition(
  current: { presence: string; status: string } | undefined,
  previous: { status: string } | undefined
) {
  if (!current) return "unknown" as const;
  if (current.presence === "absent")
    return previous ? ("removed-or-missing" as const) : ("unchanged" as const);
  if (current.status === "not-run") return "not-executed" as const;
  const failing = (status: string | undefined) =>
    status === "failed" || status === "broken";
  if (!previous)
    return failing(current.status) ? ("first-observed-failing" as const) : ("new-case" as const);
  if (failing(current.status) && failing(previous.status))
    return "persistently-failing" as const;
  if (failing(current.status)) return "newly-failing" as const;
  if (current.status === "passed" && failing(previous.status)) return "recovered" as const;
  if (current.status === "blocked" && previous.status === "blocked")
    return "still-blocked" as const;
  if (current.status === "blocked") return "newly-blocked" as const;
  return "unchanged" as const;
}

const median = (values: number[]) =>
  values.length % 2
    ? values[Math.floor(values.length / 2)]!
    : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;

export function deriveHistoricalStreamSemantics(
  inputSamples: Array<z.infer<typeof HistoricalSampleSchema>>,
  thresholds = DEFAULT_HISTORICAL_THRESHOLDS,
  identityConfidence: z.infer<typeof HistoricalIdentityConfidenceSchema> = "trusted"
) {
  const samples = [...inputSamples].sort(compareHistoricalSamples);
  const current = samples.at(-1);
  const previous = [...samples]
    .slice(0, -1)
    .reverse()
    .find((sample) => sample.presence === "present");
  const present = samples.filter((sample) => sample.presence === "present");
  const passed = present.filter((sample) => sample.status === "passed").length;
  const failed = present.filter((sample) => failedStatuses.has(sample.status)).length;
  const passFail = present.filter(
    (sample) => sample.status === "passed" || failedStatuses.has(sample.status)
  );
  let passFailTransitions = 0;
  for (let index = 1; index < passFail.length; index++)
    if (
      (passFail[index]!.status === "passed") !==
      (passFail[index - 1]!.status === "passed")
    )
      passFailTransitions++;
  let consecutiveFailures = 0;
  for (const sample of [...present].reverse()) {
    if (!failedStatuses.has(sample.status)) break;
    consecutiveFailures++;
  }
  const durations = present
    .map((sample) => sample.durationMs)
    .filter((duration): duration is number => Number.isFinite(duration) && duration !== undefined && duration >= 0);
  const latestMs = durations.at(-1);
  const previousMs = durations.at(-2);
  const absoluteChangeMs =
    latestMs !== undefined && previousMs !== undefined ? latestMs - previousMs : undefined;
  const percentageChange =
    absoluteChangeMs !== undefined && previousMs
      ? (absoluteChangeMs / previousMs) * 100
      : undefined;
  const inRunFlaky = present.some((sample) =>
    sample.implementationResults?.some((result) => result.flakyInRun)
  );
  return {
    ...(current?.presence === "present"
      ? {
          currentStatus: current.status as Exclude<
            z.infer<typeof HistoricalSampleStatusSchema>,
            "absent"
          >
        }
      : {}),
    ...(previous
      ? {
          previousStatus: previous.status as Exclude<
            z.infer<typeof HistoricalSampleStatusSchema>,
            "absent"
          >
        }
      : {}),
    transition: historicalTransition(current, previous),
    sampleSize: present.length,
    passed,
    failed,
    ...(present.length >= thresholds.minimumSamples && identityConfidence !== "conflicted"
      ? { passRate: (passed / present.length) * 100 }
      : {}),
    consecutiveFailures,
    ...(() => {
      const at = [...present].reverse().find((sample) => sample.status === "passed")?.at;
      return at ? { lastPassedAt: at } : {};
    })(),
    ...(() => {
      const at = [...present].reverse().find((sample) => failedStatuses.has(sample.status))?.at;
      return at ? { lastFailedAt: at } : {};
    })(),
    stability:
      identityConfidence === "conflicted"
        ? ("identity-conflict" as const)
        : inRunFlaky
          ? ("in-run-flaky" as const)
          : present.length < thresholds.minimumSamples
            ? ("insufficient-history" as const)
            : passed > 0 &&
                failed > 0 &&
                passFailTransitions >= thresholds.flakyTransitionThreshold
              ? ("historically-unstable" as const)
              : ("stable" as const),
    passFailTransitions,
    ...(durations.length >= thresholds.durationMinimumSamples && latestMs !== undefined
      ? {
          duration: {
            latestMs,
            medianMs: median([...durations].sort((left, right) => left - right)),
            ...(previousMs !== undefined ? { previousMs } : {}),
            ...(absoluteChangeMs !== undefined ? { absoluteChangeMs } : {}),
            ...(percentageChange !== undefined ? { percentageChange } : {}),
            recentMedianMs: median(durations.slice(-5).sort((left, right) => left - right)),
            slowRegression:
              (absoluteChangeMs ?? 0) >= thresholds.durationMinimumIncreaseMs &&
              (percentageChange ?? 0) >= thresholds.durationRegressionPercent
          }
        }
      : {})
  };
}

export const HistoricalCaseStreamSummarySchema = z
  .object({
    key: z.string().min(1),
    type: z.enum(["automated", "manual"]),
    branch: z.string().optional(),
    environment: z.string().optional(),
    identityConfidence: HistoricalIdentityConfidenceSchema,
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
    for (const [index, sample] of stream.samples.entries()) {
      if (sample.type !== stream.type)
        context.addIssue({
          code: "custom",
          path: ["samples", index, "type"],
          message: "Sample type must match its historical stream type"
        });
      if (
        stream.type === "automated" &&
        normalizeHistoricalStreamDimension(sample.branch) !==
          normalizeHistoricalStreamDimension(stream.branch)
      )
        context.addIssue({
          code: "custom",
          path: ["samples", index, "branch"],
          message: "Sample branch must match its historical stream branch"
        });
      if (
        normalizeHistoricalStreamDimension(sample.environment) !==
        normalizeHistoricalStreamDimension(stream.environment)
      )
        context.addIssue({
          code: "custom",
          path: ["samples", index, "environment"],
          message: "Sample environment must match its historical stream environment"
        });
      if (
        index > 0 &&
        compareHistoricalSamples(stream.samples[index - 1]!, sample) >= 0
      )
        context.addIssue({
          code: "custom",
          path: ["samples", index],
          message: "Historical samples must be strictly ordered oldest to newest"
        });
    }
    if (stream.stability === "historically-unstable" && stream.sampleSize < 2)
      context.addIssue({
        code: "custom",
        path: ["stability"],
        message: "Historically unstable requires at least two comparable samples"
      });
    if (
      stream.stability === "in-run-flaky" &&
      !stream.samples.some((sample) =>
        sample.implementationResults?.some((result) => result.flakyInRun)
      )
    )
      context.addIssue({
        code: "custom",
        path: ["stability"],
        message: "In-run flaky requires explicit retry-flakiness evidence"
      });
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
      if (summary.identityConfidence !== preferred.identityConfidence)
        context.addIssue({
          code: "custom",
          path: ["identityConfidence"],
          message: "identityConfidence does not agree with the preferred comparison stream"
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
    thresholds: HistoricalThresholdsSchema.optional(),
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
    const thresholds = resolveHistoricalThresholds(artifact.thresholds);
    for (const [caseIndex, summary] of artifact.cases.entries())
      for (const [streamIndex, stream] of summary.streams.entries()) {
        const expectedKey = historicalStreamKey({
          testCaseId: summary.testCaseId,
          type: stream.type,
          ...(stream.branch !== undefined ? { branch: stream.branch } : {}),
          ...(stream.environment !== undefined
            ? { environment: stream.environment }
            : {})
        });
        if (stream.key !== expectedKey)
          context.addIssue({
            code: "custom",
            path: ["cases", caseIndex, "streams", streamIndex, "key"],
            message: "Stream key does not match its canonical dimensions"
          });
        const expectedConfidence =
          deriveHistoricalStreamIdentityConfidence(stream.samples);
        if (stream.identityConfidence !== expectedConfidence)
          context.addIssue({
            code: "custom",
            path: ["cases", caseIndex, "streams", streamIndex, "identityConfidence"],
            message: "identityConfidence does not match the identities in this stream"
          });
        const expected = deriveHistoricalStreamSemantics(
          stream.samples,
          thresholds,
          stream.identityConfidence
        );
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
          "passFailTransitions"
        ] as const;
        for (const field of fields)
          if (stream[field] !== expected[field])
            context.addIssue({
              code: "custom",
              path: ["cases", caseIndex, "streams", streamIndex, field],
              message: `${field} does not match canonical stream semantics`
            });
        if (stream.stability !== expected.stability)
          context.addIssue({
            code: "custom",
            path: ["cases", caseIndex, "streams", streamIndex, "stability"],
            message: "stability does not match canonical stream semantics"
          });
        if (
          JSON.stringify(stream.duration) !== JSON.stringify(expected.duration)
        )
          context.addIssue({
            code: "custom",
            path: ["cases", caseIndex, "streams", streamIndex, "duration"],
            message: "Duration summary does not match canonical stream semantics"
          });
      }
    if (artifact.trends.runCount !== artifact.runs.length)
      context.addIssue({
        code: "custom",
        path: ["trends", "runCount"],
        message: `Trend run count ${artifact.trends.runCount} does not equal retained run count ${artifact.runs.length}`
      });
    const reportedRange = historyReportedRange(artifact.runs);
    if (
      artifact.trends.oldestAt !== undefined &&
      artifact.trends.oldestAt !== reportedRange.oldestAt
    )
      context.addIssue({
        code: "custom",
        path: ["trends", "oldestAt"],
        message: "Oldest trend timestamp does not match retained runs"
      });
    if (
      artifact.trends.newestAt !== undefined &&
      artifact.trends.newestAt !== reportedRange.newestAt
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
    const automatedStreams = artifact.cases
      .map((summary) => ({
        summary,
        stream: summary.streams
          .filter((stream) => stream.type === "automated")
          .sort(
            (left, right) =>
              Date.parse(right.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") -
                Date.parse(left.samples.at(-1)?.at ?? "1970-01-01T00:00:00.000Z") ||
              left.key.localeCompare(right.key)
          )[0]
      }))
      .filter(
        (item): item is typeof item & { stream: NonNullable<typeof item.stream> } =>
          item.stream !== undefined
      );
    const expectedTrends = {
      newFailures: automatedStreams.filter((item) =>
        ["newly-failing", "first-observed-failing"].includes(item.stream.transition)
      ).length,
      persistentFailures: automatedStreams.filter(
        (item) => item.stream.transition === "persistently-failing"
      ).length,
      recovered: automatedStreams.filter(
        (item) => item.stream.transition === "recovered"
      ).length,
      removedOrMissing: automatedStreams.filter(
        (item) => item.stream.transition === "removed-or-missing"
      ).length,
      unstable: automatedStreams.filter(
        (item) => item.stream.stability === "historically-unstable"
      ).length,
      slowRegressions: automatedStreams.filter(
        (item) => item.stream.duration?.slowRegression
      ).length
    };
    for (const field of Object.keys(expectedTrends) as Array<
      keyof typeof expectedTrends
    >)
      if (artifact.trends[field] !== expectedTrends[field])
        context.addIssue({
          code: "custom",
          path: ["trends", field],
          message: `Trend metric ${field} does not match canonical automated streams`
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
