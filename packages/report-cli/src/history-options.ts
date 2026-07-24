import {
  DEFAULT_HISTORY_OPTIONS,
  type HistoryOptions,
  type QualityReportConfig
} from "@quality-report/report-core";

export type HistoryCliOptions = {
  maxRuns?: string;
  maxAgeDays?: string;
  maxManualExecutions?: string;
  stabilityMinimumSamples?: string;
  flakyTransitionThreshold?: string;
  durationMinimumSamples?: string;
  durationRegressionPercent?: string;
  durationMinimumIncreaseMs?: string;
};

function positiveInteger(value: string | undefined, fallback: number, label: string) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved <= 0)
    throw new Error(`${label} must be a positive integer.`);
  return resolved;
}

function nonnegativeInteger(value: string | undefined, fallback: number, label: string) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < 0)
    throw new Error(`${label} must be a non-negative integer.`);
  return resolved;
}

function positiveNumber(value: string | undefined, fallback: number, label: string) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(resolved) || resolved <= 0)
    throw new Error(`${label} must be greater than zero.`);
  return resolved;
}

function nonnegativeNumber(value: string | undefined, fallback: number, label: string) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(resolved) || resolved < 0)
    throw new Error(`${label} must be zero or greater.`);
  return resolved;
}

export function resolveHistoryOptions(
  configured: QualityReportConfig["history"] | undefined,
  cli: HistoryCliOptions = {}
): Required<HistoryOptions> {
  return {
    maxRuns: positiveInteger(
      cli.maxRuns,
      configured?.maxRuns ?? DEFAULT_HISTORY_OPTIONS.maxRuns,
      "maximum retained runs"
    ),
    maxAgeDays: positiveInteger(
      cli.maxAgeDays,
      configured?.maxAgeDays ?? DEFAULT_HISTORY_OPTIONS.maxAgeDays,
      "maximum history age"
    ),
    maxManualExecutions: positiveInteger(
      cli.maxManualExecutions,
      configured?.maxManualExecutions ?? DEFAULT_HISTORY_OPTIONS.maxManualExecutions,
      "maximum retained manual executions"
    ),
    minimumSamples: positiveInteger(
      cli.stabilityMinimumSamples,
      configured?.stability.minimumSamples ?? DEFAULT_HISTORY_OPTIONS.minimumSamples,
      "stability minimum samples"
    ),
    flakyTransitionThreshold: nonnegativeInteger(
      cli.flakyTransitionThreshold,
      configured?.stability.flakyTransitionThreshold ??
        DEFAULT_HISTORY_OPTIONS.flakyTransitionThreshold,
      "flaky transition threshold"
    ),
    durationMinimumSamples: positiveInteger(
      cli.durationMinimumSamples,
      configured?.duration.minimumSamples ??
        DEFAULT_HISTORY_OPTIONS.durationMinimumSamples,
      "duration minimum samples"
    ),
    durationRegressionPercent: positiveNumber(
      cli.durationRegressionPercent,
      configured?.duration.regressionPercent ??
        DEFAULT_HISTORY_OPTIONS.durationRegressionPercent,
      "duration regression percent"
    ),
    durationMinimumIncreaseMs: nonnegativeNumber(
      cli.durationMinimumIncreaseMs,
      configured?.duration.minimumIncreaseMs ??
        DEFAULT_HISTORY_OPTIONS.durationMinimumIncreaseMs,
      "duration minimum increase"
    )
  };
}
