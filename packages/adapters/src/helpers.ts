import {
  extractRequirementKeys,
  type CoverageMetric,
  type NormalizedTestCase,
  redactSecrets,
  stableId,
  type TestFramework,
  type TestLayer,
  type TestStatus
} from "@quality-report/report-core";

export function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function pct(covered: number | undefined, total: number | undefined): number | undefined {
  if (covered === undefined || total === undefined || total === 0) return undefined;
  return Math.round((covered / total) * 10000) / 100;
}

export function metric(covered: number, missed: number): CoverageMetric {
  const total = covered + missed;
  return { covered, missed, total, percentage: pct(covered, total) };
}

export function buildTestCase(input: {
  name: string;
  suite?: string | undefined;
  file?: string | undefined;
  line?: number | undefined;
  framework: TestFramework;
  layer: TestLayer;
  status: TestStatus;
  durationMs?: number | undefined;
  retries?: number | undefined;
  message?: string | undefined;
  trace?: string | undefined;
  labels?: Record<string, string[]> | undefined;
  attachments?: Array<{ name: string; path: string; contentType?: string | undefined }> | undefined;
  requirementPattern: RegExp;
  sourcePath: string;
}): NormalizedTestCase {
  const search = [input.name, input.suite, input.file, ...(Object.values(input.labels ?? {}).flat())].join(" ");
  const requirements = extractRequirementKeys(search, input.requirementPattern);
  const id = stableId([input.framework, input.layer, input.suite, input.name, input.file, input.line]);
  return {
    id,
    name: redactSecrets(input.name) ?? input.name,
    fullName: redactSecrets([input.suite, input.name].filter(Boolean).join(" > ")) || undefined,
    ...(input.suite ? { suite: redactSecrets(input.suite) } : {}),
    ...(input.file ? { file: redactSecrets(input.file) } : {}),
    ...(input.line ? { line: input.line } : {}),
    framework: input.framework,
    layer: input.layer,
    status: input.status,
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    retries: input.retries ?? 0,
    requirements,
    labels: input.labels ?? {},
    ...(input.message || input.trace
      ? {
          error: {
            ...(input.message ? { message: redactSecrets(input.message) } : {}),
            ...(input.trace ? { trace: redactSecrets(input.trace) } : {})
          }
        }
      : {}),
    attachments: input.attachments ?? [],
    sourcePath: input.sourcePath
  };
}
