import type { QualityReportConfig } from "../config/config.js";
import type { QualityGateResult, ReportSummary } from "../schema/report.js";

export function evaluateQualityGate(
  config: QualityReportConfig,
  summary: ReportSummary
): QualityGateResult {
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
  if (config.qualityGates.coverage.totalMinimum !== undefined && summary.coverage.totalPercentage !== undefined) {
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

  return {
    status: checks.some((check) => check.status === "failed") ? "failed" : "passed",
    checks
  };
}
