import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
};

const MAX_PARSE_BYTES = 50 * 1024 * 1024;

function safeRelativePath(file: string, root: string): string {
  if (!path.isAbsolute(file)) return (redactSecrets(file) ?? file).replace(/\\/g, "/");
  const relative = path.relative(root, file);
  const safe = relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : path.basename(file);
  return (redactSecrets(safe) ?? safe).replace(/\\/g, "/");
}

async function safeRead(file: string, warnings: ParserWarning[]): Promise<string | undefined> {
  const size = (await stat(file)).size;
  if (size > MAX_PARSE_BYTES) {
    warnings.push({
      sourcePath: file,
      code: "artifact.too-large",
      message: `Skipped artifact larger than ${MAX_PARSE_BYTES} bytes.`
    });
    return undefined;
  }
  return readFile(file, "utf8");
}

function metadata(config: QualityReportConfig) {
  return {
    projectName: config.project.name,
    ...(config.project.repository ? { repository: config.project.repository } : {}),
    generatedAt: new Date().toISOString(),
    branch: redactSecrets(process.env.GITHUB_REF_NAME),
    commitSha: redactSecrets(process.env.GITHUB_SHA),
    runId: redactSecrets(process.env.GITHUB_RUN_ID),
    actor: redactSecrets(process.env.GITHUB_ACTOR)
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

async function readExpectedRequirements(artifacts: DiscoveredArtifact[], warnings: ParserWarning[]) {
  const keys: string[] = [];
  for (const artifact of artifacts.filter((item) => item.kind === "expectedRequirements")) {
    const content = await safeRead(artifact.path, warnings);
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
  warnings: ParserWarning[]
) {
  const byId = new Map(tests.map((test) => [test.id, test]));
  for (const artifact of artifacts.filter((item) => item.kind === "requirementMapping")) {
    const content = await safeRead(artifact.path, warnings);
    if (!content) continue;
    const mappings = JSON.parse(content) as Array<{ testId?: string; name?: string; requirement: string }>;
    for (const mapping of mappings) {
      const matches = mapping.testId
        ? [byId.get(mapping.testId)].filter((test): test is NormalizedTestCase => Boolean(test))
        : tests.filter((test) => test.name === mapping.name || test.fullName === mapping.name);
      for (const test of matches) test.requirements = [...new Set([...test.requirements, mapping.requirement])];
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
    await writeFile(
      path.join(outputPath, "index.html"),
      '<!doctype html><meta charset="utf-8"><title>Quality Report</title><div id="app">Report UI was not built. Run npm run build.</div>'
    );
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
  await mkdir(outputPath, { recursive: true });
  for (const entry of await readdir(outputPath)) {
    if (/^quality-report.*\.zip$/i.test(entry)) continue;
    await rm(path.join(outputPath, entry), { recursive: true, force: true });
  }
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
    const content = await safeRead(artifact.path, warnings);
    if (!content) continue;
    try {
      const context = {
        sourcePath: safeRelativePath(artifact.path, inputRoot),
        ...(artifact.layer ? { layer: artifact.layer } : {}),
        requirementPattern
      };
      if (artifact.kind === "junit") tests.push(...parseJUnitXml(content, context).items);
      if (artifact.kind === "vitestJson") tests.push(...parseVitestJson(content, context).items);
      if (artifact.kind === "playwrightJson") tests.push(...parsePlaywrightJson(content, context).items);
      if (artifact.kind === "jacocoXml") coverage.push(...parseJaCoCoXml(content, context).items);
      if (artifact.kind === "jacocoCsv") coverage.push(...parseJaCoCoCsv(content, context).items);
      if (artifact.kind === "coberturaXml") coverage.push(...parseCoberturaXml(content, context).items);
      if (artifact.kind === "lcov") coverage.push(...parseLcov(content, context).items);
      if (artifact.kind === "istanbulSummary") coverage.push(...parseIstanbulSummary(content, context).items);
      if (artifact.kind === "sarif") security.push(...parseSarif(content, context).items);
      if (artifact.kind === "zapJson") security.push(...parseZapJson(content, context).items);
    } catch (error) {
      warnings.push({
        sourcePath: safeRelativePath(artifact.path, inputRoot),
        code: "artifact.parse-failed",
        message: error instanceof Error ? error.message : "Unknown parser error"
      });
    }
  }

  const dedupedTests = deduplicateTests(tests);
  await applyRequirementMappings(dedupedTests, artifacts, warnings);
  const expected = await readExpectedRequirements(artifacts, warnings);
  const requirements = calculateRequirementCoverage(expected, dedupedTests);
  const mergedCoverage = mergeCoverage(coverage);
  for (const warning of warnings) {
    if (warning.sourcePath) warning.sourcePath = safeRelativePath(warning.sourcePath, inputRoot);
  }
  const downloads = await copyRawArtifacts(artifacts, options.outputPath, inputRoot);
  const summary = buildSummary(dedupedTests, mergedCoverage, requirements, security);
  const qualityGate = evaluateQualityGate(options.config, summary);
  const meta = metadata(options.config);
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
  }
  return report;
}
