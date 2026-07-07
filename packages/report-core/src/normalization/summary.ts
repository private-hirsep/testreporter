import type {
  CoverageSummary,
  NormalizedTestCase,
  ReportSummary,
  RequirementCoverage,
  SecurityFinding
} from "../schema/report.js";

function pct(summary: CoverageSummary | undefined): number | undefined {
  return (
    summary?.lines?.percentage ??
    summary?.statements?.percentage ??
    summary?.instructions?.percentage ??
    undefined
  );
}

export function buildSummary(
  tests: NormalizedTestCase[],
  coverage: CoverageSummary[],
  requirements: RequirementCoverage,
  security: SecurityFinding[]
): ReportSummary {
  const byStatus = {
    total: tests.length,
    passed: 0,
    failed: 0,
    broken: 0,
    skipped: 0,
    unknown: 0,
    byLayer: {
      backend: 0,
      frontend: 0,
      e2e: 0,
      unknown: 0
    }
  };
  for (const test of tests) {
    byStatus[test.status] += 1;
    byStatus.byLayer[test.layer] = (byStatus.byLayer[test.layer] ?? 0) + 1;
  }
  const securityCounts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0
  };
  for (const finding of security) {
    securityCounts[finding.severity] = (securityCounts[finding.severity] ?? 0) + 1;
  }
  const backend = coverage.find((item) => item.layer === "backend");
  const frontend = coverage.find((item) => item.layer === "frontend");
  const percentages = coverage.map(pct).filter((value): value is number => value !== undefined);
  const totalPercentage =
    percentages.length === 0
      ? undefined
      : Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 100) / 100;

  return {
    tests: byStatus,
    coverage: {
      totalPercentage,
      backendPercentage: pct(backend),
      frontendPercentage: pct(frontend)
    },
    security: securityCounts,
    requirements
  };
}
