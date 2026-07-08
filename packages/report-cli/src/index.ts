#!/usr/bin/env node
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { Command } from "commander";
import { ZodError } from "zod";
import { applyQualityProfile, loadConfig } from "./config.js";
import { discoverArtifacts } from "./discovery.js";
import { buildReport } from "./generator.js";

const program = new Command();

program.name("quality-report").description("Generate static quality reports from CI artifacts").version("0.1.0");

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
  .action(async (options: { config: string; input: string }) => {
    try {
      const config = await loadConfig(options.config);
      const artifacts = await discoverArtifacts(config, options.input);
      console.log(`Config valid for ${config.project.name}`);
      console.log(`Discovered ${artifacts.length} artifact path(s)`);
      if (artifacts.length === 0) console.warn("No artifacts matched the configured paths.");
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("summarize")
  .requiredOption("--config <path>", "Path to quality-report.yml")
  .requiredOption("--input <path>", "Artifact input directory")
  .action(async (options: { config: string; input: string }) => {
    try {
      const tmp = path.join(process.cwd(), ".quality-report-summary");
      await mkdir(tmp, { recursive: true });
      const loadedConfig = await loadConfig(options.config);
      const { config } = await applyQualityProfile(loadedConfig, "standard");
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
  });

program
  .command("generate")
  .requiredOption("--config <path>", "Path to quality-report.yml")
  .requiredOption("--input <path>", "Artifact input directory")
  .requiredOption("--output <path>", "Static report output directory")
  .option("--zip", "Create quality-report.zip in the output directory", false)
  .option("--quality-profile <profile>", "Quality gate profile", "standard")
  .option("--quality-gates <path>", "Custom quality gate profile YAML")
  .option("--fail-on-quality-gate", "Exit with status 1 when the evaluated quality gate fails", false)
  .option("--publish-mode <mode>", "Resolved or requested publish mode", "artifact")
  .option("--pr-comment-mode <mode>", "Resolved or requested PR comment mode", "off")
  .option("--pr-comment-marker <marker>", "Hidden PR comment marker", "<!-- quality-report-platform:summary -->")
  .option("--pr-comment-max-items <count>", "Maximum detailed PR comment items per section", (value) => Number(value), 10)
  .option("--full-report-url <url>", "Published full report URL")
  .option("--artifact-name <name>", "Report artifact name for PR comments")
  .action(async (options: {
    config: string;
    input: string;
    output: string;
    zip?: boolean;
    qualityProfile: string;
    qualityGates?: string;
    failOnQualityGate?: boolean;
    publishMode: string;
    prCommentMode: string;
    prCommentMarker: string;
    prCommentMaxItems: number;
    fullReportUrl?: string;
    artifactName?: string;
  }) => {
    try {
      const loadedConfig = await loadConfig(options.config);
      const { config, enabled } = await applyQualityProfile(loadedConfig, options.qualityProfile, options.qualityGates);
      await mkdir(options.output, { recursive: true });
      const report = await buildReport({
        config,
        configPath: options.config,
        inputPath: options.input,
        outputPath: options.output,
        zip: options.zip,
        qualityProfile: options.qualityProfile,
        qualityGateEnabled: enabled,
        publishMode: options.publishMode,
        prCommentMode: options.prCommentMode,
        prCommentMarker: options.prCommentMarker,
        prCommentMaxItems: options.prCommentMaxItems,
        fullReportUrl: options.fullReportUrl,
        artifactName: options.artifactName
      });
      console.log(`Generated report for ${report.metadata.projectName}: ${options.output}`);
      console.log(`Quality gate: ${report.qualityGate.status.toUpperCase()}`);
      console.log(`Quality profile: ${report.qualityGate.profile ?? options.qualityProfile}`);
      console.log(`Publish mode: ${options.publishMode}`);
      console.log(`PR comment mode: ${options.prCommentMode}`);
      if (report.warnings.length > 0) console.warn(`Completed with ${report.warnings.length} warning(s).`);
      process.exit(options.failOnQualityGate && report.qualityGate.status === "failed" ? 1 : 0);
    } catch (error) {
      handleError(error);
    }
  });

program.parseAsync().catch(handleError);
