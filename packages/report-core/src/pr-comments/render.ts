import type { NormalizedReport, SecurityFinding } from "../schema/report.js";

export type PrCommentOptions = {
  marker: string;
  maxItems: number;
  fullReportUrl?: string;
  artifactName?: string;
};

const DEFAULT_MAX_COMMENT_LENGTH = 60000;

function escapeMarkdown(value: unknown): string {
  return String(value ?? "")
    .replace(/[A-Za-z]:[\\/][^\s`'")\]]+/g, "[path]")
    .replace(/\/(?:home|tmp|Users|var|opt)\/[^\s`'")\]]+/g, "[path]")
    .replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&")
    .replace(/\r?\n/g, " ")
    .slice(0, 300);
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
    items.push(`${test.status} test: \`${escapeMarkdown(test.fullName ?? test.name)}\``);
  }
  for (const requirement of report.requirements.missing.slice(0, limit)) {
    items.push(`missing requirement: \`${escapeMarkdown(requirement)}\``);
  }
  for (const finding of report.security.filter((item) => item.severity === "critical" || item.severity === "high").slice(0, limit)) {
    items.push(`${finding.severity} security finding: ${escapeMarkdown(finding.title)}`);
  }
  for (const check of report.qualityGate.checks.filter((item) => item.status === "failed").slice(0, limit)) {
    items.push(`failed gate check: ${escapeMarkdown(check.label)} (${escapeMarkdown(check.actual)} / ${escapeMarkdown(check.expected)})`);
  }
  return items.slice(0, limit);
}

function reportLink(options: PrCommentOptions): string {
  if (options.fullReportUrl) return `Full report: ${options.fullReportUrl}`;
  if (options.artifactName) return `Full report: available in workflow artifact \`${escapeMarkdown(options.artifactName)}\`.`;
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
    `**Profile:** \`${escapeMarkdown(report.qualityGate.profile ?? report.metadata.qualityProfile ?? "standard")}\``,
    "",
    "| Area | Result |",
    "|---|---:|",
    `| Tests | ${report.summary.tests.total} total - ${report.summary.tests.failed} failed - ${report.summary.tests.broken} broken - ${report.summary.tests.skipped} skipped - ${flakyCount(report)} flaky |`,
    `| Coverage | ${formatPercent(report.summary.coverage.totalPercentage)} total - ${formatPercent(report.summary.coverage.backendPercentage)} backend - ${formatPercent(report.summary.coverage.frontendPercentage)} frontend |`,
    `| Requirements | ${formatPercent(report.requirements.percentage)} covered - ${report.requirements.missing.length} missing - ${report.requirements.extra.length} extra |`,
    `| Security | ${report.summary.security.critical ?? 0} critical - ${report.summary.security.high ?? 0} high - ${report.summary.security.medium ?? 0} medium |`,
    `| Warnings | ${report.warnings.length} parser warning${report.warnings.length === 1 ? "" : "s"} |`,
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
    "### Quality Gate Checks",
    ...report.qualityGate.checks.map((check) => `- ${gateLabel(check.status)}: ${escapeMarkdown(check.label)} (${escapeMarkdown(check.actual)} / ${escapeMarkdown(check.expected)})`),
    ...cappedList(
      "Failed and Broken Tests",
      report.tests.filter((test) => test.status === "failed" || test.status === "broken"),
      limit,
      (test) => `\`${escapeMarkdown(test.fullName ?? test.name)}\` (${escapeMarkdown(test.status)})`
    ),
    ...cappedList(
      "Slowest Tests",
      [...report.tests].filter((test) => test.durationMs !== undefined).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)),
      limit,
      (test) => `\`${escapeMarkdown(test.fullName ?? test.name)}\` - ${test.durationMs}ms`
    ),
    ...cappedList("Missing Requirements", report.requirements.missing, limit, (item) => `\`${escapeMarkdown(item)}\``),
    ...cappedList("Extra Requirements", report.requirements.extra, limit, (item) => `\`${escapeMarkdown(item)}\``),
    ...cappedList(
      "Security Findings",
      report.security.filter((finding: SecurityFinding) => ["critical", "high", "medium"].includes(finding.severity)),
      limit,
      (finding) => `${escapeMarkdown(finding.severity)}: ${escapeMarkdown(finding.title)}`
    ),
    ...cappedList("Parser Warnings", report.warnings, limit, (warning) => `${escapeMarkdown(warning.code)} - ${escapeMarkdown(warning.message)}`)
  ];
  const body = sections.join("\n");
  return body.length > DEFAULT_MAX_COMMENT_LENGTH
    ? `${body.slice(0, DEFAULT_MAX_COMMENT_LENGTH)}\n\nComment truncated. See the full report for complete details.`
    : body;
}
