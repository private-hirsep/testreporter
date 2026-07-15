import {
  extractRequirementKeys,
  type CoverageMetric,
  type NormalizedTestCase,
  type ParserWarning,
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

export function parserWarning(sourcePath: string, code: string, message: string): ParserWarning {
  return { sourcePath, code, message };
}

export function safeDisplayPath(value: string | undefined): string | undefined {
  if (!value) return value;
  const redacted = redactSecrets(value) ?? value;
  if (/^https?:\/\//i.test(redacted)) return redacted;
  const normalized = redacted.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
    const parts = normalized.split("/").filter(Boolean);
    return parts.at(-1) ?? "unknown";
  }
  return normalized;
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
  identityPattern?: RegExp | undefined;
  titleTokenPattern?: RegExp | undefined;
  annotationAliases?: string[] | undefined;
  defectPattern?: RegExp | undefined;
  sourcePath: string;
}): NormalizedTestCase {
  const search = [
    input.name,
    input.suite,
    input.file,
    ...Object.values(input.labels ?? {}).flat()
  ].join(" ");
  const requirements = extractRequirementKeys(search, input.requirementPattern);
  const id = stableId([
    input.framework,
    input.layer,
    input.suite,
    input.name,
    input.file,
    input.line
  ]);
  const file = safeDisplayPath(input.file);
  const aliases = input.annotationAliases ?? ["testCase", "test-case", "testCaseId", "case"];
  const explicitValue = aliases.flatMap((alias) => input.labels?.[alias] ?? []).find(Boolean);
  const validExplicit =
    explicitValue &&
    (!input.identityPattern ||
      new RegExp(input.identityPattern.source, input.identityPattern.flags.replace("g", "")).test(
        explicitValue
      ));
  const titleMatch = input.titleTokenPattern
    ? new RegExp(
        input.titleTokenPattern.source,
        input.titleTokenPattern.flags.replace("g", "")
      ).exec(input.name)
    : undefined;
  const titleId = titleMatch?.[1] ?? titleMatch?.[0]?.replace(/^\[|\]$/g, "");
  const canonicalId = validExplicit ? explicitValue : (titleId ?? id);
  const source = validExplicit
    ? ("explicit" as const)
    : titleId
      ? ("title-token" as const)
      : ("generated" as const);
  const defects = input.defectPattern ? extractRequirementKeys(search, input.defectPattern) : [];
  const tags = [...new Set([...(input.labels?.tag ?? []), ...(input.labels?.tags ?? [])])];
  const labels = { ...(input.labels ?? {}) };
  if (explicitValue && !validExplicit) labels.__identityMalformed = [explicitValue];
  return {
    id,
    name: redactSecrets(input.name) ?? input.name,
    fullName: redactSecrets([input.suite, input.name].filter(Boolean).join(" > ")) || undefined,
    ...(input.suite ? { suite: redactSecrets(input.suite) } : {}),
    ...(file ? { file } : {}),
    ...(input.line ? { line: input.line } : {}),
    framework: input.framework,
    layer: input.layer,
    status: input.status,
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    retries: input.retries ?? 0,
    requirements,
    identity: { canonicalId, technicalId: id, source, stable: source !== "generated" },
    defects,
    tags,
    links: [],
    labels,
    ...(input.message || input.trace
      ? {
          error: {
            ...(input.message ? { message: redactSecrets(input.message) } : {}),
            ...(input.trace ? { trace: redactSecrets(input.trace) } : {})
          }
        }
      : {}),
    attachments: (input.attachments ?? []).map((attachment) => ({
      ...attachment,
      path: safeDisplayPath(attachment.path) ?? attachment.path
    })),
    sourcePath: input.sourcePath
  };
}
