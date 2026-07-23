#!/usr/bin/env node
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { Command } from "commander";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { discoverArtifacts } from "./discovery.js";
import { buildReport } from "./generator.js";
import { buildPortfolio } from "./portfolio.js";
import { TOOL_VERSION } from "./version.js";
import { mergeHistoryDirectory } from "./history.js";
import { deriveHistoryArtifact } from "@quality-report/report-core";
import { writeEvidence, writeProjectSummary } from "./evidence.js";

const program = new Command();

const historyCommand = program.command("history").description("Manage compact Git-first history");

historyCommand
  .command("merge")
  .option("--history-dir <path>", "Existing Git-friendly history directory")
  .requiredOption("--current-report <path>", "Current normalized-report.json")
  .requiredOption("--output-dir <path>", "Atomically written next history directory")
  .option("--static-output <path>", "Optimized static history.json output")
  .option("--source-report-url <url>", "Stable URL of the full report")
  .option("--project-summary-output <path>", "Write project summary with derived history")
  .option("--max-runs <count>", "Maximum retained automated runs", "50")
  .option("--max-age-days <days>", "Maximum automated run age", "180")
  .option("--max-manual-executions <count>", "Maximum retained manual executions", "200")
  .action(
    async (options: {
      historyDir?: string;
      currentReport: string;
      outputDir: string;
      staticOutput?: string;
      sourceReportUrl?: string;
      projectSummaryOutput?: string;
      maxRuns: string;
      maxAgeDays: string;
      maxManualExecutions: string;
    }) => {
      try {
        const store = await mergeHistoryDirectory({
          currentReport: options.currentReport,
          outputDir: options.outputDir,
          ...(options.historyDir ? { historyDir: options.historyDir } : {}),
          ...(options.staticOutput ? { staticOutput: options.staticOutput } : {}),
          ...(options.sourceReportUrl ? { sourceReportUrl: options.sourceReportUrl } : {}),
          ...(options.projectSummaryOutput
            ? { projectSummaryOutput: options.projectSummaryOutput }
            : {}),
          retention: {
            maxRuns: Number(options.maxRuns),
            maxAgeDays: Number(options.maxAgeDays),
            maxManualExecutions: Number(options.maxManualExecutions)
          }
        });
        console.log(
          `History contains ${store.runs.length} automated run(s) and ${store.manualExecutions.length} manual execution(s): ${options.outputDir}`
        );
      } catch (error) {
        handleError(error);
      }
    }
  );

program
  .command("portfolio")
  .requiredOption("--input <path>", "Directory containing project summaries")
  .requiredOption("--output <path>", "Static portfolio output directory")
  .option("--stale-days <days>", "Age after which a summary is stale", "7")
  .action(async (options: { input: string; output: string; staleDays: string }) => { try { const projects = await buildPortfolio(options.input, options.output, Number(options.staleDays)); console.log(`Generated portfolio for ${projects.length} project(s): ${options.output}`); } catch (error) { handleError(error); } });

program
  .name("quality-report")
  .description("Generate static quality reports from CI artifacts")
  .version(TOOL_VERSION);

function handleError(error: unknown): never {
  if (error instanceof ZodError) {
    console.error("Invalid configuration:");
    for (const issue of error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    process.exit(2);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

program
  .command("validate")
  .requiredOption("--config <path>", "Path to quality-report.yml")
  .requiredOption("--input <path>", "Artifact input directory")
  .option("--quality-profile <profile>", "Quality gate profile to validate with")
  .option("--quality-gates <path>", "Compatibility alias for external quality gates config")
  .action(
    async (options: {
      config: string;
      input: string;
      qualityProfile?: string;
      qualityGates?: string;
    }) => {
      try {
        const config = await loadConfig(
          options.config,
          options.qualityProfile,
          options.qualityGates
        );
        const artifacts = await discoverArtifacts(config, options.input);
        console.log(`Config valid for ${config.project.name}`);
        console.log(`Discovered ${artifacts.length} artifact path(s)`);
        if (artifacts.length === 0) console.warn("No artifacts matched the configured paths.");
      } catch (error) {
        handleError(error);
      }
    }
  );

program
  .command("summarize")
  .requiredOption("--config <path>", "Path to quality-report.yml")
  .requiredOption("--input <path>", "Artifact input directory")
  .option("--quality-profile <profile>", "Quality gate profile to summarize with")
  .option("--quality-gates <path>", "Compatibility alias for external quality gates config")
  .action(
    async (options: {
      config: string;
      input: string;
      qualityProfile?: string;
      qualityGates?: string;
    }) => {
      try {
        const tmp = path.join(process.cwd(), ".quality-report-summary");
        await mkdir(tmp, { recursive: true });
        const config = await loadConfig(
          options.config,
          options.qualityProfile,
          options.qualityGates
        );
        const report = await buildReport({
          config,
          configPath: options.config,
          inputPath: options.input,
          outputPath: tmp
        });
        console.log(`Quality gate: ${report.qualityGate.status.toUpperCase()}`);
        console.log(
          `Tests: ${report.summary.tests.total} total, ${report.summary.tests.failed} failed, ${report.summary.tests.broken} broken, ${report.summary.tests.skipped} skipped`
        );
        console.log(`Coverage: ${report.summary.coverage.totalPercentage ?? "n/a"}%`);
        console.log(`Requirements: ${report.summary.requirements.percentage}%`);
        console.log(
          `Security: critical=${report.summary.security.critical ?? 0}, high=${report.summary.security.high ?? 0}, medium=${report.summary.security.medium ?? 0}`
        );
        if (report.warnings.length > 0) console.log(`Warnings: ${report.warnings.length}`);
        process.exit(report.qualityGate.status === "failed" ? 1 : 0);
      } catch (error) {
        handleError(error);
      }
    }
  );

program
  .command("generate")
  .requiredOption("--config <path>", "Path to quality-report.yml")
  .requiredOption("--input <path>", "Artifact input directory")
  .requiredOption("--output <path>", "Static report output directory")
  .option("--quality-profile <profile>", "Quality gate profile to use")
  .option("--quality-gates <path>", "Compatibility alias for external quality gates config")
  .option(
    "--publish-mode <mode>",
    "Resolved workflow publish mode to include in generated metadata"
  )
  .option(
    "--pr-comment-mode <mode>",
    "Resolved workflow PR comment mode to include in generated metadata"
  )
  .option(
    "--pr-comment-marker <marker>",
    "Marker used in generated PR comments for update-in-place workflows"
  )
  .option(
    "--fail-on-quality-gate",
    "Exit with status 1 when the selected quality gate fails",
    false
  )
  .option("--no-fail-on-quality-gate", "Do not fail when the selected quality gate fails")
  .option("--zip", "Create quality-report.zip in the output directory", false)
  .option("--release <name>", "Release name/version")
  .option("--tested-build <id>", "Tested build identifier")
  .option("--commit-sha <sha>", "Commit SHA")
  .option("--branch <name>", "Branch")
  .option("--environment <name>", "Test environment")
  .option("--workflow-run <id>", "Workflow run identifier or URL")
  .option("--execution-id <id>", "Explicit execution identity")
  .option("--release-date <date>", "Release date")
  .option("--release-scope <path>", "Release scope YAML or JSON")
  .option("--history-dir <path>", "Existing Git-friendly history directory")
  .option("--history-output-dir <path>", "Atomically write the next history directory")
  .action(
    async (options: {
      config: string;
      input: string;
      output: string;
      qualityProfile?: string;
      qualityGates?: string;
      publishMode?: string;
      prCommentMode?: string;
      prCommentMarker?: string;
      failOnQualityGate?: boolean;
      zip?: boolean;
      release?: string; testedBuild?: string; commitSha?: string; branch?: string; environment?: string; workflowRun?: string; executionId?: string; releaseDate?: string; releaseScope?: string; historyDir?: string; historyOutputDir?: string;
    }) => {
      try {
        const config = await loadConfig(
          options.config,
          options.qualityProfile,
          options.qualityGates
        );
        await mkdir(options.output, { recursive: true });
        const report = await buildReport({
          config,
          configPath: options.config,
          inputPath: options.input,
          outputPath: options.output,
          zip: options.zip,
          qualityProfile: options.qualityProfile,
          publishMode: options.publishMode,
          prCommentMode: options.prCommentMode,
          prCommentMarker: options.prCommentMarker
          ,...(options.release ? { release: options.release } : {}), ...(options.testedBuild ? { testedBuild: options.testedBuild } : {}), ...(options.commitSha ? { commitSha: options.commitSha } : {}), ...(options.branch ? { branch: options.branch } : {}), ...(options.environment ? { environment: options.environment } : {}), ...(options.workflowRun ? { workflowRun: options.workflowRun } : {}), ...(options.executionId ? { executionId: options.executionId } : {}), ...(options.releaseDate ? { releaseDate: options.releaseDate } : {}), ...(options.releaseScope ? { releaseScope: options.releaseScope } : {})
        });
        if (config.history.enabled && options.historyOutputDir) {
          const store = await mergeHistoryDirectory({
            ...(options.historyDir ? { historyDir: options.historyDir } : {}),
            currentReport: path.join(options.output, "normalized-report.json"),
            outputDir: options.historyOutputDir,
            staticOutput: path.join(options.output, "data", "history.json"),
            ...(config.project.reportUrl ? { sourceReportUrl: config.project.reportUrl } : {}),
            retention: {
              maxRuns: config.history.maxRuns,
              maxAgeDays: config.history.maxAgeDays,
              maxManualExecutions: config.history.maxManualExecutions,
              minimumSamples: config.history.stability.minimumSamples,
              flakyTransitionThreshold: config.history.stability.flakyTransitionThreshold,
              durationMinimumSamples: config.history.duration.minimumSamples,
              durationRegressionPercent: config.history.duration.regressionPercent,
              durationMinimumIncreaseMs: config.history.duration.minimumIncreaseMs
            }
          });
          await writeProjectSummary(
            options.output,
            report,
            config.project.reportUrl,
            deriveHistoryArtifact(store, {
              minimumSamples: config.history.stability.minimumSamples,
              flakyTransitionThreshold: config.history.stability.flakyTransitionThreshold,
              durationMinimumSamples: config.history.duration.minimumSamples,
              durationRegressionPercent: config.history.duration.regressionPercent,
              durationMinimumIncreaseMs: config.history.duration.minimumIncreaseMs
            })
          );
          await writeEvidence(options.output, report);
        }
        console.log(`Generated report for ${report.metadata.projectName}: ${options.output}`);
        console.log(`Quality gate: ${report.qualityGate.status.toUpperCase()}`);
        if (report.warnings.length > 0)
          console.warn(`Completed with ${report.warnings.length} warning(s).`);
        process.exit(options.failOnQualityGate && report.qualityGate.status === "failed" ? 1 : 0);
      } catch (error) {
        handleError(error);
      }
    }
  );

program.parseAsync().catch(handleError);
