import type { NormalizedReport, SecurityFinding } from "../schema/report.js";
import { redactSecrets } from "../utils/redact.js";

export type PrCommentOptions = {
  marker: string;
  maxItems: number;
  fullReportUrl?: string;
  artifactName?: string;
  publishMode?: string;
  prCommentMode?: string;
};

const DEFAULT_MAX_COMMENT_LENGTH = 60000;
const DEFAULT_VALUE_LIMIT = 300;

function sanitizeValue(value: unknown, limit = DEFAULT_VALUE_LIMIT): string {
  const sanitized = (redactSecrets(String(value ?? "")) ?? "")
    .replace(/(^|[\s([:{])([A-Za-z]:[\\/][^\s`'")\]]+)/g, "$1[path]")
    .replace(/\/(?:home|tmp|Users|var|opt)\/[^\s`'")\]]+/g, "[path]")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.length > limit ? `${sanitized.slice(0, Math.max(0, limit - 3))}...` : sanitized;
}

export function escapeMarkdownText(value: unknown): string {
  return sanitizeValue(value)
    .replace(/<(?=[A-Za-z/!])/g, "&lt;")
    .replace(/\\/g, "\\\\")
    .replace(/([*_#[\]()])/g, "\\$1");
}

export function escapeMarkdownTableCell(value: unknown): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|");
}

export function formatInlineCode(value: unknown): string {
  const sanitized = sanitizeValue(value).replace(/<(?=[A-Za-z/!])/g, "&lt;");
  const runs = sanitized.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const delimiter = "`".repeat(longest + 1 || 1);
  const padding = sanitized.startsWith("`") || sanitized.endsWith("`") ? " " : "";
  return `${delimiter}${padding}${sanitized}${padding}${delimiter}`;
}

export function formatCodeBlock(value: unknown): string {
  const sanitized = sanitizeValue(value, 4000);
  const runs = sanitized.match(/`{3,}/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 2);
  const delimiter = "`".repeat(longest + 1);
  return `${delimiter}\n${sanitized}\n${delimiter}`;
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${Math.round(value * 10) / 10}%`;
}

function gateLabel(status: string): string {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Not evaluated";
}

function flakyCount(report: NormalizedReport): number {
  return report.tests.filter((test) => test.retries > 0).length;
}

function blockers(report: NormalizedReport, limit: number): string[] {
  const items: string[] = [];
  for (const test of report.tests.filter((item) => item.status === "failed" || item.status === "broken").slice(0, limit)) {
    items.push(`${escapeMarkdownText(test.status)} test: ${formatInlineCode(test.fullName ?? test.name)}`);
  }
  for (const requirement of report.requirements.missing.slice(0, limit)) {
    items.push(`missing requirement: ${formatInlineCode(requirement)}`);
  }
  for (const finding of report.security.filter((item) => item.severity === "critical" || item.severity === "high").slice(0, limit)) {
    items.push(`${escapeMarkdownText(finding.severity)} security finding: ${escapeMarkdownText(finding.title)}`);
  }
  for (const check of report.qualityGate.checks.filter((item) => item.status === "failed").slice(0, limit)) {
    items.push(
      `failed gate check: ${escapeMarkdownText(check.label)} (${escapeMarkdownText(check.actual)} / ${escapeMarkdownText(check.expected)})`
    );
  }
  return items.slice(0, limit);
}

function reportLink(options: PrCommentOptions): string {
  if (options.fullReportUrl) return `Full report: ${escapeMarkdownText(options.fullReportUrl)}`;
  if (options.publishMode === "none") return "Full report: not published for this run.";
  if (options.artifactName) return `Full report: available in workflow artifact ${formatInlineCode(options.artifactName)}.`;
  return "Full report: not published for this run.";
}

function marker(value: string): string {
  return /^<!--[\s\S]*-->$/.test(value.trim()) ? value.trim() : "<!-- quality-report-platform:summary -->";
}

export function renderMinimalPrComment(report: NormalizedReport, options: PrCommentOptions): string {
  const topItems = blockers(report, Math.max(1, options.maxItems));
  return [
    marker(options.marker),
    "## Quality Report",
    "",
    `**Gate:** ${gateLabel(report.qualityGate.status)}`,
    `**Profile:** ${formatInlineCode(report.qualityGate.profile ?? report.metadata.qualityProfile ?? "standard")}`,
    "",
    "| Area | Result |",
    "|---|---:|",
    `| Tests | ${escapeMarkdownTableCell(`${report.summary.tests.total} total - ${report.summary.tests.failed} failed - ${report.summary.tests.broken} broken - ${report.summary.tests.skipped} skipped - ${flakyCount(report)} flaky`)} |`,
    `| Coverage | ${escapeMarkdownTableCell(`${formatPercent(report.summary.coverage.totalPercentage)} total - ${formatPercent(report.summary.coverage.backendPercentage)} backend - ${formatPercent(report.summary.coverage.frontendPercentage)} frontend`)} |`,
    `| Requirements | ${escapeMarkdownTableCell(`${formatPercent(report.requirements.percentage)} covered - ${report.requirements.missing.length} missing - ${report.requirements.extra.length} extra`)} |`,
    `| Security | ${escapeMarkdownTableCell(`${report.summary.security.critical ?? 0} critical - ${report.summary.security.high ?? 0} high - ${report.summary.security.medium ?? 0} medium`)} |`,
    `| Warnings | ${escapeMarkdownTableCell(`${report.warnings.length} parser warning${report.warnings.length === 1 ? "" : "s"}`)} |`,
    "",
    topItems.length ? "Top items:" : "Top items: none",
    ...topItems.map((item) => `- ${item}`),
    "",
    reportLink(options)
  ].join("\n");
}

function cappedList<T>(title: string, items: T[], limit: number, render: (item: T) => string): string[] {
  if (!items.length) return [];
  const capped = items.slice(0, limit);
  return [
    "",
    `### ${title}`,
    ...capped.map((item) => `- ${render(item)}`),
    ...(items.length > capped.length ? [`- ${items.length - capped.length} more item(s) omitted.`] : [])
  ];
}

export function renderFullPrComment(report: NormalizedReport, options: PrCommentOptions): string {
  const limit = Math.max(1, options.maxItems);
  const sections = [
    renderMinimalPrComment(report, options),
    "",
    ...(options.publishMode || options.prCommentMode
      ? [
          "### Delivery",
          ...(options.publishMode ? [`- Publish mode: ${formatInlineCode(options.publishMode)}`] : []),
          ...(options.prCommentMode ? [`- PR comment mode: ${formatInlineCode(options.prCommentMode)}`] : [])
        ]
      : []),
    "",
    "### Quality Gate Checks",
    ...report.qualityGate.checks.map(
      (check) =>
        `- ${gateLabel(check.status)}: ${escapeMarkdownText(check.label)} (${escapeMarkdownText(check.actual)} / ${escapeMarkdownText(check.expected)})`
    ),
    ...cappedList(
      "Failed and Broken Tests",
      report.tests.filter((test) => test.status === "failed" || test.status === "broken"),
      limit,
      (test) => `${formatInlineCode(test.fullName ?? test.name)} (${escapeMarkdownText(test.status)})`
    ),
    ...cappedList(
      "Slowest Tests",
      [...report.tests].filter((test) => test.durationMs !== undefined).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)),
      limit,
      (test) => `${formatInlineCode(test.fullName ?? test.name)} - ${test.durationMs}ms`
    ),
    ...cappedList("Missing Requirements", report.requirements.missing, limit, (item) => formatInlineCode(item)),
    ...cappedList("Extra Requirements", report.requirements.extra, limit, (item) => formatInlineCode(item)),
    ...cappedList(
      "Security Findings",
      report.security.filter((finding: SecurityFinding) => ["critical", "high", "medium"].includes(finding.severity)),
      limit,
      (finding) => `${escapeMarkdownText(finding.severity)}: ${escapeMarkdownText(finding.title)}`
    ),
    ...cappedList(
      "Parser Warnings",
      report.warnings,
      limit,
      (warning) => `${escapeMarkdownText(warning.code)} - ${escapeMarkdownText(warning.message)}`
    )
  ];
  const body = sections.join("\n");
  return body.length > DEFAULT_MAX_COMMENT_LENGTH
    ? `${body.slice(0, DEFAULT_MAX_COMMENT_LENGTH)}\n\nComment truncated. See the full report for complete details.`
    : body;
}
