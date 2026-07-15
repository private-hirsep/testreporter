import type { QualityReportConfig } from "../config/config.js";
import type { ParserWarning, QualityGateResult, ReportSummary } from "../schema/report.js";

export function evaluateQualityGate(
  config: QualityReportConfig,
  summary: ReportSummary,
  warnings: ParserWarning[] = [],
  options: { profile?: string; enabled?: boolean } = {}
): QualityGateResult {
  if (options.enabled === false || config.qualityGates.enabled === false) {
    return {
      status: "skipped",
      profile: options.profile,
      enabled: false,
      checks: [
        {
          id: "quality-gate.off",
          label: "Quality gate",
          actual: "report-only",
          expected: "profile enabled",
          status: "skipped",
          message: "Quality gate profile disables failing checks."
        }
      ]
    };
  }
  const checks: QualityGateResult["checks"] = [];
  const add = (
    id: string,
    label: string,
    actual: number,
    expected: string,
    passed: boolean,
    message?: string
  ) => {
    checks.push({
      id,
      label,
      actual,
      expected,
      status: passed ? "passed" : "failed",
      ...(message ? { message } : {})
    });
  };
  const manual = config.qualityGates.manual;
  if (manual?.requireCompleted)
    add(
      "manual.completed",
      "Required manual cases completed",
      summary.manual.notRun,
      "= 0",
      summary.manual.notRun === 0
    );
  if (manual?.failOnFailed)
    add(
      "manual.failed",
      "Failed manual cases",
      summary.manual.failed,
      "= 0",
      summary.manual.failed === 0
    );
  if (manual?.failOnBlocked)
    add(
      "manual.blocked",
      "Blocked manual cases",
      summary.manual.blocked,
      "= 0",
      summary.manual.blocked === 0
    );
  if (manual?.minimumCompletion !== undefined)
    add(
      "manual.completion",
      "Manual completion",
      summary.manual.completionPercentage,
      `>= ${manual.minimumCompletion}%`,
      summary.manual.completionPercentage >= manual.minimumCompletion
    );

  add(
    "tests.failed",
    "Failed tests",
    summary.tests.failed,
    `<= ${config.qualityGates.tests.allowFailed}`,
    summary.tests.failed <= config.qualityGates.tests.allowFailed
  );
  add(
    "tests.broken",
    "Broken tests",
    summary.tests.broken,
    `<= ${config.qualityGates.tests.allowBroken}`,
    summary.tests.broken <= config.qualityGates.tests.allowBroken
  );
  if (
    config.qualityGates.tests.allowSkipped !== undefined &&
    config.qualityGates.tests.allowSkipped !== null
  ) {
    add(
      "tests.skipped",
      "Skipped tests",
      summary.tests.skipped,
      `<= ${config.qualityGates.tests.allowSkipped}`,
      summary.tests.skipped <= config.qualityGates.tests.allowSkipped
    );
  }
  if (
    config.qualityGates.coverage.totalMinimum !== undefined &&
    summary.coverage.totalPercentage !== undefined
  ) {
    add(
      "coverage.total",
      "Total coverage",
      summary.coverage.totalPercentage,
      `>= ${config.qualityGates.coverage.totalMinimum}%`,
      summary.coverage.totalPercentage >= config.qualityGates.coverage.totalMinimum
    );
  }
  if (
    config.qualityGates.coverage.backendMinimum !== undefined &&
    summary.coverage.backendPercentage !== undefined
  ) {
    add(
      "coverage.backend",
      "Backend coverage",
      summary.coverage.backendPercentage,
      `>= ${config.qualityGates.coverage.backendMinimum}%`,
      summary.coverage.backendPercentage >= config.qualityGates.coverage.backendMinimum
    );
  }
  if (
    config.qualityGates.coverage.frontendMinimum !== undefined &&
    summary.coverage.frontendPercentage !== undefined
  ) {
    add(
      "coverage.frontend",
      "Frontend coverage",
      summary.coverage.frontendPercentage,
      `>= ${config.qualityGates.coverage.frontendMinimum}%`,
      summary.coverage.frontendPercentage >= config.qualityGates.coverage.frontendMinimum
    );
  }
  if (config.qualityGates.requirements.minimum !== undefined) {
    add(
      "requirements.minimum",
      "Requirement coverage",
      summary.requirements.percentage,
      `>= ${config.qualityGates.requirements.minimum}%`,
      summary.requirements.percentage >= config.qualityGates.requirements.minimum
    );
  }
  if (config.qualityGates.requirements.failOnMissing) {
    add(
      "requirements.missing",
      "Missing requirements",
      summary.requirements.missing.length,
      "= 0",
      summary.requirements.missing.length === 0
    );
  }
  if (config.qualityGates.requirements.failOnExtra) {
    add(
      "requirements.extra",
      "Extra requirements",
      summary.requirements.extra.length,
      "= 0",
      summary.requirements.extra.length === 0
    );
  }
  add(
    "security.critical",
    "Critical security findings",
    summary.security.critical ?? 0,
    `<= ${config.qualityGates.security.maxCritical}`,
    (summary.security.critical ?? 0) <= config.qualityGates.security.maxCritical
  );
  add(
    "security.high",
    "High security findings",
    summary.security.high ?? 0,
    `<= ${config.qualityGates.security.maxHigh}`,
    (summary.security.high ?? 0) <= config.qualityGates.security.maxHigh
  );
  if (
    config.qualityGates.security.maxMedium !== undefined &&
    config.qualityGates.security.maxMedium !== null
  ) {
    add(
      "security.medium",
      "Medium security findings",
      summary.security.medium ?? 0,
      `<= ${config.qualityGates.security.maxMedium}`,
      (summary.security.medium ?? 0) <= config.qualityGates.security.maxMedium
    );
  }
  if (
    config.qualityGates.security.maxLow !== undefined &&
    config.qualityGates.security.maxLow !== null
  ) {
    add(
      "security.low",
      "Low security findings",
      summary.security.low ?? 0,
      `<= ${config.qualityGates.security.maxLow}`,
      (summary.security.low ?? 0) <= config.qualityGates.security.maxLow
    );
  }
  if (
    config.qualityGates.warnings.maxWarnings !== undefined &&
    config.qualityGates.warnings.maxWarnings !== null
  ) {
    add(
      "warnings.maxWarnings",
      "Parser warnings",
      warnings.length,
      `<= ${config.qualityGates.warnings.maxWarnings}`,
      warnings.length <= config.qualityGates.warnings.maxWarnings
    );
  }

  return {
    status: checks.some((check) => check.status === "failed") ? "failed" : "passed",
    profile: options.profile,
    enabled: true,
    checks
  };
}
