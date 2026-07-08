import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import fs from "fs-extra";
import {
  buildSummary,
  calculateRequirementCoverage,
  deduplicateTests,
  evaluateQualityGate,
  NormalizedReportSchema,
  redactSecrets,
  stableId,
  type CoverageSummary,
  type DownloadableArtifact,
  type NormalizedReport,
  type NormalizedTestCase,
  type ParserWarning,
  type QualityGateCheck,
  type QualityReportConfig,
  type SecurityFinding
} from "@quality-report/report-core";
import {
  parseCoberturaXml,
  parseIstanbulSummary,
  parseJaCoCoCsv,
  parseJaCoCoXml,
  parseJUnitXml,
  parseLcov,
  parsePlaywrightJson,
  parseSarif,
  parseVitestJson,
  parseZapJson
} from "@quality-report/adapters";
import { discoverArtifacts, type DiscoveredArtifact } from "./discovery.js";

export type GenerateOptions = {
  config: QualityReportConfig;
  configPath: string;
  inputPath: string;
  outputPath: string;
  zip?: boolean | undefined;
  qualityProfile?: string | undefined;
  publishMode?: string | undefined;
  prCommentMode?: string | undefined;
  prCommentMarker?: string | undefined;
};

const MAX_PARSE_BYTES = 50 * 1024 * 1024;
const DEFAULT_PR_COMMENT_MARKER = "<!-- quality-report-platform:summary -->";

function collectParseResult<T>(
  target: T[],
  result: { items: T[]; warnings: ParserWarning[] },
  warnings: ParserWarning[]
) {
  target.push(...result.items);
  warnings.push(...result.warnings);
}

function safeRelativePath(file: string, root: string): string {
  if (!path.isAbsolute(file)) return (redactSecrets(file) ?? file).replace(/\\/g, "/");
  const relative = path.relative(root, file);
  const safe =
    relative && !relative.startsWith("..") && !path.isAbsolute(relative)
      ? relative
      : path.basename(file);
  return (redactSecrets(safe) ?? safe).replace(/\\/g, "/");
}

function artifactDisplayPath(inputPath: string, file: string) {
  const relative = path.relative(inputPath, file).replace(/\\/g, "/");
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative
    : path.basename(file);
}

async function safeRead(
  file: string,
  warnings: ParserWarning[],
  displayPath: string
): Promise<string | undefined> {
  const size = (await stat(file)).size;
  if (size > MAX_PARSE_BYTES) {
    warnings.push({
      sourcePath: displayPath,
      code: "artifact.too-large",
      message: `Skipped artifact larger than ${MAX_PARSE_BYTES} bytes.`
    });
    return undefined;
  }
  return readFile(file, "utf8");
}

function metadata(config: QualityReportConfig, options: GenerateOptions) {
  return {
    projectName: config.project.name,
    ...(config.project.repository ? { repository: config.project.repository } : {}),
    generatedAt: new Date().toISOString(),
    branch: redactSecrets(process.env.GITHUB_REF_NAME),
    commitSha: redactSecrets(process.env.GITHUB_SHA),
    runId: redactSecrets(process.env.GITHUB_RUN_ID),
    actor: redactSecrets(process.env.GITHUB_ACTOR),
    ...(options.qualityProfile ? { qualityProfile: options.qualityProfile } : {}),
    ...(options.publishMode ? { publishMode: options.publishMode } : {}),
    ...(options.prCommentMode ? { prCommentMode: options.prCommentMode } : {})
  };
}

function mergeCoverage(items: CoverageSummary[]): CoverageSummary[] {
  const grouped = new Map<string, CoverageSummary[]>();
  for (const item of items) grouped.set(item.layer, [...(grouped.get(item.layer) ?? []), item]);
  return [...grouped.entries()].map(([, group]) => {
    const first = group[0]!;
    return {
      ...first,
      files: group.flatMap((item) => item.files),
      rawLinks: group.flatMap((item) => item.rawLinks)
    };
  });
}

async function readExpectedRequirements(
  artifacts: DiscoveredArtifact[],
  warnings: ParserWarning[],
  inputPath: string
) {
  const keys: string[] = [];
  for (const artifact of artifacts.filter((item) => item.kind === "expectedRequirements")) {
    const content = await safeRead(
      artifact.path,
      warnings,
      artifactDisplayPath(inputPath, artifact.path)
    );
    if (!content) continue;
    for (const line of content.split(/\r?\n/)) {
      const key = line.split(",")[0]?.trim();
      if (key && key.toLowerCase() !== "key") keys.push(key);
    }
  }
  return [...new Set(keys)];
}

async function applyRequirementMappings(
  tests: NormalizedTestCase[],
  artifacts: DiscoveredArtifact[],
  warnings: ParserWarning[],
  inputPath: string
) {
  const byId = new Map(tests.map((test) => [test.id, test]));
  for (const artifact of artifacts.filter((item) => item.kind === "requirementMapping")) {
    const content = await safeRead(
      artifact.path,
      warnings,
      artifactDisplayPath(inputPath, artifact.path)
    );
    if (!content) continue;
    let mappings: Array<{
      testId?: string;
      name?: string;
      requirement: string;
    }>;
    try {
      mappings = JSON.parse(content) as Array<{
        testId?: string;
        name?: string;
        requirement: string;
      }>;
    } catch (error) {
      warnings.push({
        sourcePath: artifactDisplayPath(inputPath, artifact.path),
        code: "requirements.mapping.parse-failed",
        message: error instanceof Error ? error.message : "Malformed requirement mapping JSON."
      });
      continue;
    }
    for (const mapping of mappings) {
      if (!mapping.requirement) continue;
      const matches = mapping.testId
        ? [byId.get(mapping.testId)].filter((test): test is NormalizedTestCase => Boolean(test))
        : tests.filter((test) => test.name === mapping.name || test.fullName === mapping.name);
      for (const test of matches)
        test.requirements = [...new Set([...test.requirements, mapping.requirement])];
    }
  }
}

async function copyRawArtifacts(
  artifacts: DiscoveredArtifact[],
  outputPath: string,
  inputRoot: string
): Promise<DownloadableArtifact[]> {
  const downloads: DownloadableArtifact[] = [];
  const rawDir = path.join(outputPath, "raw");
  await mkdir(rawDir, { recursive: true });
  for (const artifact of artifacts) {
    const isDirectory = (await stat(artifact.path)).isDirectory();
    const name = path.basename(artifact.path);
    const target = path.join(rawDir, `${stableId([artifact.kind, artifact.path])}-${name}`);
    await fs.copy(artifact.path, target, { dereference: false });
    downloads.push({
      id: stableId(["download", artifact.path]),
      name,
      category:
        artifact.kind === "sarif" || artifact.kind === "zapJson"
          ? "security"
          : artifact.kind.includes("jacoco") ||
              artifact.kind === "lcov" ||
              artifact.kind === "istanbulSummary" ||
              artifact.kind === "coberturaXml"
            ? "coverage"
            : artifact.kind === "expectedRequirements" || artifact.kind === "requirementMapping"
              ? "requirements"
              : artifact.kind === "rawHtml"
                ? "raw"
                : "tests",
      path: path.relative(outputPath, target).replace(/\\/g, "/"),
      sourcePath: safeRelativePath(artifact.path, inputRoot),
      sizeBytes: isDirectory ? undefined : (await stat(artifact.path)).size
    });
  }
  return downloads;
}

async function copyUi(outputPath: string) {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(current, "../../report-ui/dist"),
    path.resolve(current, "../../../packages/report-ui/dist")
  ];
  const source = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
  if (!source) {
    const fallbackHtml = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      "<title>Quality Report</title>",
      "</head>",
      "<body>",
      '<div id="app">Report UI was not built. Run npm run build.</div>',
      "</body>",
      "</html>"
    ].join("");
    await writeFile(path.join(outputPath, "index.html"), fallbackHtml);
    await writeFile(path.join(outputPath, "404.html"), fallbackHtml);
    return;
  }
  await fs.copy(source, outputPath, { overwrite: true });
}

async function writeData(outputPath: string, report: NormalizedReport) {
  const dataDir = path.join(outputPath, "data");
  await mkdir(dataDir, { recursive: true });
  const chunkSize = 500;
  const testChunks = [];
  for (let index = 0; index < report.tests.length; index += chunkSize) {
    const chunkName: string = `tests-${testChunks.length}.json`;
    testChunks.push(chunkName);
    await writeFile(
      path.join(dataDir, chunkName),
      JSON.stringify(report.tests.slice(index, index + chunkSize), null, 2)
    );
  }
  const manifest = {
    schemaVersion: report.schemaVersion,
    metadata: report.metadata,
    summary: report.summary,
    requirements: report.requirements,
    coverage: report.coverage,
    security: report.security,
    qualityGate: report.qualityGate,
    downloads: report.downloads,
    warnings: report.warnings,
    history: report.history,
    chunks: { tests: testChunks }
  };
  await writeFile(path.join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function markdownEscape(value: string | number | undefined): string {
  return String(value ?? "n/a").replace(/[\\`*_{}[\]()#+\-.!|<>]/g, "\\$&");
}

function qualitySummary(report: NormalizedReport) {
  return {
    qualityGateStatus: report.qualityGate.status,
    projectName: report.metadata.projectName,
    generatedAt: report.metadata.generatedAt,
    publishMode: report.metadata.publishMode,
    prCommentMode: report.metadata.prCommentMode,
    tests: report.summary.tests,
    coverage: report.summary.coverage,
    requirements: {
      percentage: report.summary.requirements.percentage,
      expected: report.summary.requirements.expected.length,
      covered: report.summary.requirements.covered.length,
      missing: report.summary.requirements.missing.length
    },
    security: report.summary.security,
    warnings: report.warnings.length,
    failedChecks: report.qualityGate.checks.filter(
      (check: QualityGateCheck) => check.status === "failed"
    )
  };
}

async function writeMeta(outputPath: string, report: NormalizedReport, prCommentMarker: string) {
  const metaDir = path.join(outputPath, "meta");
  await mkdir(metaDir, { recursive: true });
  const summary = qualitySummary(report);
  await writeFile(path.join(metaDir, "quality-summary.json"), JSON.stringify(summary, null, 2));

  const gateIcon = report.qualityGate.status === "passed" ? "PASS" : "FAIL";
  const minimal = [
    prCommentMarker,
    `## Quality Report: ${gateIcon}`,
    "",
    `Project: **${markdownEscape(report.metadata.projectName)}**`,
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Tests | ${report.summary.tests.total} total, ${report.summary.tests.failed} failed, ${report.summary.tests.broken} broken |`,
    `| Coverage | ${markdownEscape(report.summary.coverage.totalPercentage)}% |`,
    `| Requirements | ${report.summary.requirements.percentage}% |`,
    `| Security | critical ${report.summary.security.critical ?? 0}, high ${report.summary.security.high ?? 0} |`,
    `| Warnings | ${report.warnings.length} |`,
    "",
    `Generated from run \`${markdownEscape(report.metadata.runId)}\`.`
  ].join("\n");

  const failedChecks = report.qualityGate.checks
    .filter((check: QualityGateCheck) => check.status === "failed")
    .map(
      (check) =>
        `- ${markdownEscape(check.label)}: ${markdownEscape(check.actual)} expected ${markdownEscape(check.expected)}`
    );
  const full = [
    minimal,
    "",
    "### Quality Gate Checks",
    "",
    "| Check | Actual | Expected | Status |",
    "| --- | ---: | --- | --- |",
    ...report.qualityGate.checks.map(
      (check: QualityGateCheck) =>
        `| ${markdownEscape(check.label)} | ${markdownEscape(check.actual)} | ${markdownEscape(check.expected)} | ${markdownEscape(check.status)} |`
    ),
    "",
    "### Failed Checks",
    "",
    ...(failedChecks.length > 0 ? failedChecks : ["- None"])
  ].join("\n");

  await writeFile(path.join(metaDir, "pr-comment-minimal.md"), `${minimal}\n`);
  await writeFile(path.join(metaDir, "pr-comment-full.md"), `${full}\n`);
}

async function zipDirectory(source: string, target: string) {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(target);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", { cwd: source, ignore: ["quality-report*.zip"] });
    void archive.finalize();
  });
}

async function cleanOutput(outputPath: string) {
  await rm(outputPath, { recursive: true, force: true });
  await mkdir(outputPath, { recursive: true });
}

export async function buildReport(options: GenerateOptions): Promise<NormalizedReport> {
  await cleanOutput(options.outputPath);
  const artifacts = await discoverArtifacts(options.config, options.inputPath);
  const inputRoot = path.resolve(options.inputPath);
  const warnings: ParserWarning[] = [];
  const tests: NormalizedTestCase[] = [];
  const coverage: CoverageSummary[] = [];
  const security: SecurityFinding[] = [];
  const requirementPattern = new RegExp(options.config.requirements.keyPattern, "g");

  for (const artifact of artifacts) {
    if (["expectedRequirements", "requirementMapping", "rawHtml"].includes(artifact.kind)) continue;
    const displayPath = artifactDisplayPath(options.inputPath, artifact.path);
    const content = await safeRead(artifact.path, warnings, displayPath);
    if (content === undefined) continue;
    try {
      const context = {
        sourcePath: displayPath,
        ...(artifact.layer ? { layer: artifact.layer } : {}),
        requirementPattern
      };
      if (artifact.kind === "junit")
        collectParseResult(tests, parseJUnitXml(content, context), warnings);
      if (artifact.kind === "vitestJson")
        collectParseResult(tests, parseVitestJson(content, context), warnings);
      if (artifact.kind === "playwrightJson")
        collectParseResult(tests, parsePlaywrightJson(content, context), warnings);
      if (artifact.kind === "jacocoXml")
        collectParseResult(coverage, parseJaCoCoXml(content, context), warnings);
      if (artifact.kind === "jacocoCsv")
        collectParseResult(coverage, parseJaCoCoCsv(content, context), warnings);
      if (artifact.kind === "coberturaXml")
        collectParseResult(coverage, parseCoberturaXml(content, context), warnings);
      if (artifact.kind === "lcov")
        collectParseResult(coverage, parseLcov(content, context), warnings);
      if (artifact.kind === "istanbulSummary")
        collectParseResult(coverage, parseIstanbulSummary(content, context), warnings);
      if (artifact.kind === "sarif")
        collectParseResult(security, parseSarif(content, context), warnings);
      if (artifact.kind === "zapJson")
        collectParseResult(security, parseZapJson(content, context), warnings);
    } catch (error) {
      warnings.push({
        sourcePath: displayPath,
        code: "artifact.parse-failed",
        message: error instanceof Error ? error.message : "Unknown parser error"
      });
    }
  }

  const dedupedTests = deduplicateTests(tests);
  await applyRequirementMappings(dedupedTests, artifacts, warnings, options.inputPath);
  const expected = await readExpectedRequirements(artifacts, warnings, options.inputPath);
  const requirements = calculateRequirementCoverage(expected, dedupedTests);
  const mergedCoverage = mergeCoverage(coverage);
  for (const warning of warnings) {
    if (warning.sourcePath) warning.sourcePath = safeRelativePath(warning.sourcePath, inputRoot);
  }
  const downloads = await copyRawArtifacts(artifacts, options.outputPath, inputRoot);
  const summary = buildSummary(dedupedTests, mergedCoverage, requirements, security);
  const qualityGate = evaluateQualityGate(options.config, summary, warnings);
  const meta = metadata(options.config, options);
  const report = NormalizedReportSchema.parse({
    schemaVersion: "1.0",
    metadata: meta,
    summary,
    tests: dedupedTests,
    coverage: mergedCoverage,
    requirements,
    security,
    qualityGate,
    downloads,
    history: {
      runs: [
        {
          id: stableId(["history", meta.generatedAt, process.env.GITHUB_RUN_ID]),
          generatedAt: meta.generatedAt,
          qualityGateStatus: qualityGate.status,
          testsTotal: summary.tests.total,
          testsFailed: summary.tests.failed,
          coveragePercentage: summary.coverage.totalPercentage,
          requirementCoveragePercentage: summary.requirements.percentage,
          criticalFindings: summary.security.critical ?? 0,
          highFindings: summary.security.high ?? 0
        }
      ]
    },
    warnings
  });

  await copyUi(options.outputPath);
  await writeData(options.outputPath, report);
  const prCommentMarker = options.prCommentMarker ?? DEFAULT_PR_COMMENT_MARKER;
  await writeMeta(options.outputPath, report, prCommentMarker);
  if (options.zip) {
    const zipFile = `quality-report-${Date.now()}.zip`;
    const zipPath = path.join(options.outputPath, zipFile);
    const tmpZip = path.join(path.dirname(options.outputPath), `quality-report-${Date.now()}.zip`);
    await zipDirectory(options.outputPath, tmpZip);
    await rename(tmpZip, zipPath);
    report.downloads.push({
      id: stableId(["download", zipPath]),
      name: "Full generated report ZIP",
      category: "report",
      path: zipFile,
      sizeBytes: (await stat(zipPath)).size
    });
    await writeData(options.outputPath, report);
    await writeMeta(options.outputPath, report, prCommentMarker);
  }
  return report;
}
