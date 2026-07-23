import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import {
  deriveHistoryArtifact,
  type NormalizedReport,
  type ProjectQualitySummary
} from "@quality-report/report-core";
import { TOOL_VERSION } from "./version.js";

export async function sha256(file: string) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function evidenceCategory(file: string, report: NormalizedReport) {
  const download = report.downloads.find((item) => item.path === file);
  if (download) return download.category;
  if (file === "normalized-report.json") return "normalized-report";
  if (file === "project-quality-summary.json") return "project-summary";
  if (file.startsWith("meta/")) return "human-readable-summary";
  if (file.startsWith("data/")) return "report-data";
  return "static-report";
}

export async function writeEvidence(output: string, report: NormalizedReport) {
  const files = (
    await fg("**/*", {
      cwd: output,
      onlyFiles: true,
      dot: true,
      ignore: [
        "quality-report*.zip",
        "evidence-manifest.json",
        "checksums.sha256",
        "data/history.json"
      ]
    })
  )
    .map((file) => file.replace(/\\/g, "/"))
    .sort();
  const included = await Promise.all(
    files.map(async (file) => ({
      path: file,
      category: evidenceCategory(file, report),
      sha256: await sha256(path.join(output, file))
    }))
  );
  const scopedRequirements = report.readiness?.requirements;
  const scopedIncluded = scopedRequirements
    ? scopedRequirements.covered + scopedRequirements.uncovered
    : report.requirements.expected.length;
  const manifest = {
    schemaVersion: "1.0",
    project: report.metadata.projectName,
    release: report.metadata.release,
    testedBuild: report.metadata.testedBuild,
    commit: report.metadata.commitSha,
    branch: report.metadata.branch,
    workflowRun: report.metadata.workflowRun ?? report.metadata.runId,
    generatedAt: report.metadata.generatedAt,
    reportSchemaVersion: report.schemaVersion,
    toolVersion: TOOL_VERSION,
    qualityProfile: report.metadata.qualityProfile,
    automated: report.summary.tests,
    manual: report.summary.manual,
    requirements: {
      covered: report.readiness?.requirements.covered ?? report.requirements.covered.length,
      expected: scopedIncluded,
      included: scopedIncluded,
      uncovered: report.readiness?.requirements.uncovered ?? report.requirements.missing.length,
      excluded: scopedRequirements?.excluded ?? 0,
      total: scopedIncluded + (scopedRequirements?.excluded ?? 0)
    },
    security: report.summary.security,
    acceptedRisks: report.readiness?.acceptedRisks ?? [],
    testDefinitionBaseline: report.git?.commit,
    includedEvidence: included,
    externalLinks: report.downloads
      .filter((item) => /^https?:/.test(item.path))
      .map((item) => item.path)
      .sort(),
    missingEvidence: report.readiness?.missingEvidence ?? [],
    locallyDraftedManualWorkExcluded: report.manualExecutions.filter(
      (item) => item.state === "draft"
    ).length
  };
  const manifestPath = path.join(output, "evidence-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const checksums = [
    ...included,
    {
      path: "evidence-manifest.json",
      category: "evidence-manifest",
      sha256: await sha256(manifestPath)
    }
  ].sort((left, right) => left.path.localeCompare(right.path));
  await writeFile(
    path.join(output, "checksums.sha256"),
    `${checksums.map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`
  );
  return manifest;
}

export async function writeProjectSummary(
  output: string,
  report: NormalizedReport,
  reportUrl?: string,
  history?: ReturnType<typeof deriveHistoryArtifact>
) {
  const value: ProjectQualitySummary = {
    schemaVersion: "1.0",
    projectKey: report.metadata.projectKey ?? report.metadata.projectName,
    projectName: report.metadata.projectName,
    release: report.metadata.release,
    reportUrl,
    generatedAt: report.metadata.generatedAt,
    qualityGate: report.qualityGate.status,
    readiness: report.readiness?.status ?? "incomplete",
    passedTests: report.summary.tests.passed,
    failedTests: report.summary.tests.failed + report.summary.tests.broken,
    newFailures: history?.trends.newFailures ?? 0,
    manualRemaining: report.readiness?.manual.notRun ?? report.summary.manual.notRun,
    uncoveredRequirements:
      report.readiness?.requirements.uncovered ?? report.requirements.missing.length,
    securityBlockers: report.readiness?.securityBlockers ?? 0,
    acceptedRisks: report.readiness?.acceptedRisks.length ?? 0,
    recommendedActions: report.readiness?.actions.length ?? 0,
    ...(history
      ? {
          history: {
            schemaVersion: "1.0" as const,
            available: history.availability === "available",
            retainedRunCount: history.runs.length,
            ...(history.trends.oldestAt ? { oldestRunAt: history.trends.oldestAt } : {}),
            ...(history.trends.newestAt ? { newestRunAt: history.trends.newestAt } : {}),
            ...(history.runs[1]?.readiness?.status
              ? {
                  previousReadiness: history.runs[1].readiness.status as
                    | "ready"
                    | "ready-with-accepted-risks"
                    | "warning"
                    | "blocked"
                    | "incomplete"
                }
              : {}),
            ...(history.runs[1]?.qualityGate?.status
              ? {
                  previousQualityGate: history.runs[1].qualityGate.status as
                    | "passed"
                    | "failed"
                    | "skipped"
                    | "not_evaluated"
                }
              : {}),
            newFailures: history.trends.newFailures,
            persistentFailures: history.trends.persistentFailures,
            recovered: history.trends.recovered,
            removedOrMissing: history.trends.removedOrMissing,
            unstableCases: history.trends.unstable,
            slowRegressions: history.trends.slowRegressions,
            trendAvailable: history.availability === "available",
            sparkline: [...history.runs]
              .reverse()
              .slice(-12)
              .map((run) => ({
                runId: run.id,
                reportedAt: run.reportedAt,
                status: run.status,
                passed: run.counts.passed,
                failed: run.counts.failed,
                broken: run.counts.broken
              }))
          }
        }
      : {})
  };
  await writeFile(
    path.join(output, "project-quality-summary.json"),
    `${JSON.stringify(value, null, 2)}\n`
  );
  return value;
}
