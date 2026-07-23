import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import fs from "fs-extra";
import {
  buildSummary,
  calculateIdentityDiagnostics,
  calculateRequirementCoverage,
  deduplicateTests,
  deriveTestCaseCatalogue,
  deriveUnifiedExecutions,
  determineReadiness,
  evaluateQualityGate,
  NormalizedReportSchema,
  ReleaseScopeSchema,
  redactSecrets,
  stableId,
  type CoverageSummary,
  type DownloadableArtifact,
  type NormalizedReport,
  type NormalizedTestCase,
  type ParserWarning,
  type QualityGateCheck,
  type QualityReportConfig,
  type SecurityFinding,
  type ManualCase,
  type ManualExecution
} from "@quality-report/report-core";
import { parse as parseYaml } from "yaml";
import {
  parseCoberturaXml,
  parseIstanbulSummary,
  parseJaCoCoCsv,
  parseJaCoCoXml,
  parseJUnitXml,
  parseLcov,
  parseManualCase,
  parseManualExecution,
  parsePlaywrightJson,
  parseSarif,
  parseVitestJson,
  parseZapJson
} from "@quality-report/adapters";
import { discoverArtifacts, type DiscoveredArtifact } from "./discovery.js";
import { collectGitHistory } from "./git-history.js";
import { writeEvidence, writeProjectSummary } from "./evidence.js";

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
  release?: string;
  testedBuild?: string;
  commitSha?: string;
  branch?: string;
  environment?: string;
  workflowRun?: string;
  releaseDate?: string;
  releaseScope?: string;
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
    ...(config.project.key ? { projectKey: config.project.key } : {}),
    projectName: config.project.name,
    ...(config.project.repository ? { repository: config.project.repository } : {}),
    generatedAt: new Date().toISOString(),
    branch: redactSecrets(
      options.branch ??
        process.env.QR_BRANCH ??
        process.env.GITHUB_REF_NAME ??
        config.release.branch
    ),
    commitSha: redactSecrets(
      options.commitSha ??
        process.env.QR_COMMIT_SHA ??
        process.env.GITHUB_SHA ??
        config.release.commitSha
    ),
    runId: redactSecrets(process.env.GITHUB_RUN_ID),
    actor: redactSecrets(process.env.GITHUB_ACTOR),
    release: redactSecrets(options.release ?? process.env.QR_RELEASE ?? config.release.name),
    testedBuild: redactSecrets(
      options.testedBuild ?? process.env.QR_TESTED_BUILD ?? config.release.testedBuild
    ),
    environment: redactSecrets(
      options.environment ?? process.env.QR_ENVIRONMENT ?? config.release.environment
    ),
    workflowRun: redactSecrets(
      options.workflowRun ??
        process.env.QR_WORKFLOW_RUN ??
        process.env.GITHUB_RUN_ID ??
        config.release.workflowRun
    ),
    releaseDate: redactSecrets(
      options.releaseDate ?? process.env.QR_RELEASE_DATE ?? config.release.releaseDate
    ),
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

type TestMapping = {
  match: { framework?: string; file?: string; suite?: string; fullName?: string; title?: string };
  canonicalId?: string;
  requirements?: string[];
  defects?: string[];
  tags?: string[];
  links?: Array<{ label: string; url: string }>;
};

const TEST_MAPPING_SELECTORS = ["framework", "file", "suite", "fullName", "title"] as const;

function exactPatternMatch(pattern: RegExp, value: string): boolean {
  return new RegExp(
    `^(?:${pattern.source})$`,
    pattern.flags.replace("g", "").replace("y", "")
  ).test(value);
}

function parseStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item))
    throw new Error(`${field} must be an array of non-empty strings.`);
  return [...new Set(value)];
}

function parseTestMapping(value: unknown, index: number, identityPattern: RegExp): TestMapping {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Entry ${index} must be an object.`);
  const entry = value as Record<string, unknown>;
  if (!entry.match || typeof entry.match !== "object" || Array.isArray(entry.match))
    throw new Error(`Entry ${index}.match must be an object.`);
  const rawMatch = entry.match as Record<string, unknown>;
  const match: TestMapping["match"] = {};
  for (const selector of TEST_MAPPING_SELECTORS) {
    const selectorValue = rawMatch[selector];
    if (selectorValue !== undefined) {
      if (typeof selectorValue !== "string" || !selectorValue.trim())
        throw new Error(`Entry ${index}.match.${selector} must be a non-empty string.`);
      match[selector] = selectorValue;
    }
  }
  if (Object.keys(match).length === 0)
    throw new Error(`Entry ${index}.match must contain at least one selector.`);
  if (
    entry.canonicalId !== undefined &&
    (typeof entry.canonicalId !== "string" ||
      !exactPatternMatch(identityPattern, entry.canonicalId))
  )
    throw new Error(`Entry ${index}.canonicalId does not exactly match identity.idPattern.`);
  let links: TestMapping["links"];
  if (entry.links !== undefined) {
    if (!Array.isArray(entry.links)) throw new Error(`Entry ${index}.links must be an array.`);
    links = entry.links.map((link, linkIndex) => {
      if (!link || typeof link !== "object" || Array.isArray(link))
        throw new Error(`Entry ${index}.links[${linkIndex}] must be an object.`);
      const item = link as Record<string, unknown>;
      if (typeof item.label !== "string" || !item.label)
        throw new Error(`Entry ${index}.links[${linkIndex}].label must be a non-empty string.`);
      if (typeof item.url !== "string")
        throw new Error(`Entry ${index}.links[${linkIndex}].url must be a URL.`);
      try {
        const url = new URL(item.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsafe protocol");
      } catch {
        throw new Error(`Entry ${index}.links[${linkIndex}].url must be a valid HTTP(S) URL.`);
      }
      return { label: item.label, url: item.url };
    });
  }
  const requirements = parseStringArray(entry.requirements, `Entry ${index}.requirements`);
  const defects = parseStringArray(entry.defects, `Entry ${index}.defects`);
  const tags = parseStringArray(entry.tags, `Entry ${index}.tags`);
  return {
    match,
    ...(typeof entry.canonicalId === "string" ? { canonicalId: entry.canonicalId } : {}),
    ...(requirements ? { requirements } : {}),
    ...(defects ? { defects } : {}),
    ...(tags ? { tags } : {}),
    ...(links ? { links } : {})
  };
}

function matchesTest(test: NormalizedTestCase, match: TestMapping["match"]): boolean {
  return (
    (!match.framework || test.framework === match.framework) &&
    (!match.file || test.file === match.file) &&
    (!match.suite || test.suite === match.suite) &&
    (!match.fullName || test.fullName === match.fullName) &&
    (!match.title || test.name === match.title)
  );
}

async function applyTestMappings(
  tests: NormalizedTestCase[],
  artifacts: DiscoveredArtifact[],
  warnings: ParserWarning[],
  inputPath: string,
  identityPattern: RegExp
) {
  const mappings: TestMapping[] = [];
  for (const artifact of artifacts.filter((item) => item.kind === "testMapping")) {
    const display = artifactDisplayPath(inputPath, artifact.path);
    const content = await safeRead(artifact.path, warnings, display);
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Test mapping must be a JSON array.");
      for (const [index, entry] of parsed.entries()) {
        try {
          mappings.push(parseTestMapping(entry, index, identityPattern));
        } catch (error) {
          warnings.push({
            sourcePath: display,
            code: "identity.mapping.invalid-entry",
            message: error instanceof Error ? error.message : `Invalid mapping entry ${index}.`
          });
        }
      }
    } catch (error) {
      warnings.push({
        sourcePath: display,
        code: "identity.mapping.parse-failed",
        message: error instanceof Error ? error.message : "Malformed test mapping JSON."
      });
    }
  }
  for (const test of tests) {
    const candidates = mappings.filter(
      (mapping) => mapping.match && matchesTest(test, mapping.match)
    );
    if (!candidates.length) continue;
    const specificity = Math.max(
      ...candidates.map((mapping) => Object.values(mapping.match).filter(Boolean).length)
    );
    const selected = candidates.filter(
      (mapping) => Object.values(mapping.match).filter(Boolean).length === specificity
    );
    if (selected.length !== 1) {
      warnings.push({
        sourcePath: test.sourcePath,
        code: "identity.mapping.ambiguous",
        message: `Ambiguous test mapping for ${test.fullName ?? test.name}; ${selected.length} equally specific entries matched.`
      });
      continue;
    }
    const mapping = selected[0]!;
    if (mapping.canonicalId && test.identity?.source === "generated")
      test.identity = {
        ...test.identity,
        canonicalId: mapping.canonicalId,
        source: "mapping",
        stable: true
      };
    test.requirements = [...new Set([...test.requirements, ...(mapping.requirements ?? [])])];
    test.defects = [...new Set([...test.defects, ...(mapping.defects ?? [])])];
    test.tags = [...new Set([...test.tags, ...(mapping.tags ?? [])])];
    test.links = [
      ...test.links,
      ...(mapping.links ?? []).map((link) => ({ type: "external" as const, ...link }))
    ];
  }
}

function addConfiguredLinks(tests: NormalizedTestCase[], config: QualityReportConfig) {
  for (const test of tests) {
    const requirement = config.links.requirement?.baseUrl;
    const defect = config.links.defect?.baseUrl;
    test.links = [
      ...test.links,
      ...(requirement
        ? test.requirements.map((key) => ({
            type: "requirement" as const,
            key,
            label: key,
            url: new URL(encodeURIComponent(key), requirement).toString()
          }))
        : []),
      ...(defect
        ? test.defects.map((key) => ({
            type: "defect" as const,
            key,
            label: key,
            url: new URL(encodeURIComponent(key), defect).toString()
          }))
        : [])
    ];
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
      category: artifact.kind.startsWith("manual")
        ? "manual"
        : artifact.kind === "sarif" || artifact.kind === "zapJson"
          ? "security"
          : artifact.kind.includes("jacoco") ||
              artifact.kind === "lcov" ||
              artifact.kind === "istanbulSummary" ||
              artifact.kind === "coberturaXml"
            ? "coverage"
            : artifact.kind === "expectedRequirements" ||
                artifact.kind === "requirementMapping" ||
                artifact.kind === "testMapping"
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
    identityDiagnostics: report.identityDiagnostics,
    testCaseCatalogue: report.testCaseCatalogue,
    unifiedExecutions: report.unifiedExecutions,
    manualCases: report.manualCases,
    manualExecutions: report.manualExecutions,
    releaseScope: report.releaseScope,
    readiness: report.readiness,
    git: report.git,
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
    const archive = archiver("zip", { zlib: { level: 9 }, forceLocalTime: false });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob(
      "**/*",
      { cwd: source, ignore: ["quality-report*.zip"], nodir: true },
      { date: new Date("1980-01-01T00:00:00.000Z") }
    );
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
  const manualCases: ManualCase[] = [];
  const manualExecutions: ManualExecution[] = [];
  const manualExecutionPaths = new Map<string, string>();
  const requirementPattern = new RegExp(options.config.requirements.keyPattern, "g");

  for (const artifact of artifacts) {
    if (
      [
        "expectedRequirements",
        "requirementMapping",
        "testMapping",
        "rawHtml",
        "manualEvidence"
      ].includes(artifact.kind)
    )
      continue;
    const displayPath = artifactDisplayPath(options.inputPath, artifact.path);
    const content = await safeRead(artifact.path, warnings, displayPath);
    if (content === undefined) continue;
    try {
      const context = {
        sourcePath: displayPath,
        ...(artifact.layer ? { layer: artifact.layer } : {}),
        requirementPattern,
        identityPattern: new RegExp(options.config.identity.idPattern),
        titleTokenPattern: new RegExp(options.config.identity.titleTokenPattern),
        annotationAliases: options.config.identity.annotationAliases,
        defectPattern: new RegExp(options.config.defects.keyPattern, "g")
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
      if (artifact.kind === "manualCase")
        collectParseResult(manualCases, parseManualCase(content, displayPath), warnings);
      if (artifact.kind === "manualResult") {
        const parsed = parseManualExecution(content, displayPath);
        collectParseResult(manualExecutions, parsed, warnings);
        for (const execution of parsed.items)
          manualExecutionPaths.set(execution.executionId, artifact.path);
      }
    } catch (error) {
      warnings.push({
        sourcePath: displayPath,
        code: "artifact.parse-failed",
        message: error instanceof Error ? error.message : "Unknown parser error"
      });
    }
  }

  const dedupedTests = deduplicateTests(tests);
  const duplicateManualIds = manualCases
    .filter((item, index) => manualCases.findIndex((other) => other.id === item.id) !== index)
    .map((item) => item.id);
  if (duplicateManualIds.length)
    warnings.push({
      code: "manual.case.duplicate-id",
      message: `Duplicate manual case IDs: ${[...new Set(duplicateManualIds)].join(", ")}`
    });
  const uniqueManualCases = manualCases.filter(
    (item, index) => manualCases.findIndex((other) => other.id === item.id) === index
  );
  const activeManualCases = uniqueManualCases.filter((item) => item.status === "approved");
  const activeDefinitions = new Map(activeManualCases.map((item) => [item.id, item]));
  const definitionIssues = (execution: ManualExecution) =>
    execution.cases.flatMap((result) => {
      const definition = activeDefinitions.get(result.caseId);
      if (!definition) return [`${result.caseId} is not an approved manual case`];
      const indices = result.steps.map((step) => step.index);
      const expectedIndices = definition.steps.map((_, index) => index);
      const issues: string[] = [];
      if (
        indices.length !== expectedIndices.length ||
        indices.some((value, index) => value !== expectedIndices[index])
      )
        issues.push(`${result.caseId} step indices do not match its definition`);
      if (definition.revision && result.caseRevision !== definition.revision)
        issues.push(`${result.caseId} revision does not match its definition`);
      return issues;
    });
  const officialManualExecutions = manualExecutions
    .filter((execution) => {
      if (execution.state !== "completed") return false;
      const issues = definitionIssues(execution);
      for (const message of issues)
        warnings.push({
          code: "manual.execution.definition-mismatch",
          sourcePath: manualExecutionPaths.get(execution.executionId),
          message
        });
      return issues.length === 0;
    })
    .sort(
      (left, right) =>
        left.completedAt!.localeCompare(right.completedAt!) ||
        left.executionId.localeCompare(right.executionId)
    );
  const officialManualResultPaths = new Set(
    officialManualExecutions
      .map((execution) => manualExecutionPaths.get(execution.executionId))
      .filter((value): value is string => Boolean(value))
  );
  const latest = new Map<
    string,
    { completedAt: string; executionId: string; result: ManualExecution["cases"][number] }
  >();
  for (const execution of officialManualExecutions)
    for (const result of execution.cases)
      latest.set(result.caseId, {
        completedAt: execution.completedAt!,
        executionId: execution.executionId,
        result
      });
  for (const test of dedupedTests) {
    const malformed = test.labels.__identityMalformed;
    if (malformed?.length)
      warnings.push({
        sourcePath: test.sourcePath,
        code: "identity.explicit.malformed",
        message: `Malformed explicit test ID: ${malformed.join(", ")}`
      });
    delete test.labels.__identityMalformed;
  }
  await applyTestMappings(
    dedupedTests,
    artifacts,
    warnings,
    options.inputPath,
    new RegExp(options.config.identity.idPattern)
  );
  await applyRequirementMappings(dedupedTests, artifacts, warnings, options.inputPath);
  addConfiguredLinks(dedupedTests, options.config);
  const expected = await readExpectedRequirements(artifacts, warnings, options.inputPath);
  const requirements = calculateRequirementCoverage(expected, dedupedTests);
  for (const manualCase of activeManualCases) {
    for (const key of manualCase.requirements) {
      requirements.manualCasesByRequirement[key] = [
        ...new Set([...(requirements.manualCasesByRequirement[key] ?? []), manualCase.id])
      ].sort();
      const latestCaseResults = requirements.manualCasesByRequirement[key]!.map(
        (id) => latest.get(id)?.result.status ?? "not-run"
      );
      const manualResult = latestCaseResults.includes("failed")
        ? "failed"
        : latestCaseResults.includes("blocked")
          ? "blocked"
          : latestCaseResults.includes("not-run")
            ? "not-run"
            : latestCaseResults.includes("passed")
              ? "passed"
              : latestCaseResults.includes("skipped")
                ? "skipped"
                : "not-run";
      requirements.latestManualResultByRequirement[key] = manualResult;
      const automated = Boolean(requirements.testsByRequirement[key]?.length);
      const hasManualEvidence = latestCaseResults.some((status) => status !== "not-run");
      requirements.evidenceTypeByRequirement[key] =
        automated && hasManualEvidence
          ? "both"
          : automated
            ? "automated"
            : hasManualEvidence
              ? "manual-executed"
              : "manual-defined";
    }
  }
  const successfulManualRequirements = Object.entries(requirements.latestManualResultByRequirement)
    .filter(([, status]) => status === "passed")
    .map(([key]) => key);
  requirements.covered = [
    ...new Set([
      ...requirements.covered,
      ...successfulManualRequirements.filter((key) => requirements.expected.includes(key))
    ])
  ].sort();
  requirements.missing = requirements.expected.filter((key) => !requirements.covered.includes(key));
  requirements.percentage =
    requirements.expected.length === 0
      ? 100
      : Math.round((requirements.covered.length / requirements.expected.length) * 10000) / 100;
  for (const key of Object.keys(requirements.testsByRequirement))
    if (!requirements.evidenceTypeByRequirement[key])
      requirements.evidenceTypeByRequirement[key] = "automated";
  const mergedCoverage = mergeCoverage(coverage);
  for (const warning of warnings) {
    if (warning.sourcePath) warning.sourcePath = safeRelativePath(warning.sourcePath, inputRoot);
  }
  const officialArtifacts = artifacts.filter(
    (artifact) => artifact.kind !== "manualResult" || officialManualResultPaths.has(artifact.path)
  );
  const downloads = await copyRawArtifacts(officialArtifacts, options.outputPath, inputRoot);
  const summary = buildSummary(dedupedTests, mergedCoverage, requirements, security);
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 };
  for (const item of activeManualCases) {
    const status = latest.get(item.id)?.result.status ?? "not-run";
    counts[status === "not-run" ? "notRun" : status] += 1;
  }
  const executed = activeManualCases.length - counts.notRun;
  summary.manual = {
    cases: activeManualCases.length,
    executed,
    ...counts,
    completionPercentage: activeManualCases.length
      ? Math.round((executed / activeManualCases.length) * 10000) / 100
      : 100,
    missingEvidence: (() => {
      const available = new Set(
        artifacts
          .filter((artifact) => artifact.kind === "manualEvidence")
          .map((artifact) => artifactDisplayPath(options.inputPath, artifact.path))
      );
      const referenced = officialManualExecutions
        .flatMap((execution) => execution.cases)
        .flatMap((result) => [
          ...result.evidence,
          ...result.steps.flatMap((step) => step.evidence)
        ]);
      const missing = [
        ...new Set(
          referenced
            .map((name) => name.replace(/\\/g, "/"))
            .filter(
              (name) =>
                path.posix.isAbsolute(name) ||
                path.posix.normalize(name).startsWith("../") ||
                !available.has(path.posix.normalize(name))
            )
        )
      ];
      for (const name of missing)
        warnings.push({
          code: "manual.evidence.missing",
          message: `Manual evidence reference does not resolve exactly: ${name}`
        });
      return missing.length;
    })()
  };
  const qualityGate = evaluateQualityGate(options.config, summary, warnings);
  const meta = metadata(options.config, options);
  let releaseScope;
  const scopePath = options.releaseScope ?? options.config.release.scope;
  if (scopePath) {
    try {
      const absolute = path.resolve(path.dirname(options.configPath), scopePath);
      releaseScope = ReleaseScopeSchema.parse(parseYaml(await readFile(absolute, "utf8")));
      if (!meta.release) meta.release = releaseScope.release;
      const knownRequirements = new Set([
        ...requirements.expected,
        ...requirements.covered,
        ...requirements.extra
      ]);
      const knownManualCases = new Set(uniqueManualCases.map((item) => item.id));
      for (const id of releaseScope.requirements.filter((id) => !knownRequirements.has(id)))
        warnings.push({
          code: "release-scope.unknown-requirement",
          message: `Unknown requirement ID: ${id}`
        });
      for (const id of releaseScope.requiredManualCases.filter((id) => !knownManualCases.has(id)))
        warnings.push({
          code: "release-scope.unknown-manual-case",
          message: `Unknown manual case ID: ${id}`
        });
      if (meta.release && releaseScope.release !== meta.release)
        warnings.push({
          code: "release-scope.release-mismatch",
          message: `Release scope ${releaseScope.release} does not match report release ${meta.release}.`
        });
    } catch (error) {
      warnings.push({
        code: "release-scope.invalid",
        message: error instanceof Error ? error.message : "Invalid release scope"
      });
    }
  }
  const manualStatuses = Object.fromEntries(
    activeManualCases.map((item) => [item.id, latest.get(item.id)?.result.status ?? "not-run"])
  );
  const readiness = determineReadiness({
    project: meta.projectKey ?? meta.projectName,
    ...(releaseScope ? { scope: releaseScope } : {}),
    ...(meta.release ? { reportRelease: meta.release } : {}),
    tests: dedupedTests,
    manualStatuses,
    coveredRequirements: requirements.covered,
    security,
    qualityGateStatus: qualityGate.status,
    qualityGateFailures: qualityGate.checks
      .filter((check) => check.status === "failed")
      .map((check) => ({
        id: check.id,
        label: check.label,
        ...(check.message ? { message: check.message } : {})
      })),
    missingEvidence: summary.manual.missingEvidence
      ? [`${summary.manual.missingEvidence} manual evidence reference(s)`]
      : []
  });
  const manualHistoryTargets: NormalizedTestCase[] = uniqueManualCases.map((item) => ({
    id: item.id,
    name: item.title,
    framework: "unknown",
    layer: "unknown",
    status: "unknown",
    retries: 0,
    requirements: item.requirements,
    defects: [],
    tags: item.tags,
    links: [],
    labels: {},
    attachments: [],
    ...(item.sourcePath ? { file: item.sourcePath } : {})
  }));
  const gitResult = options.config.git.enabled
    ? await collectGitHistory(
        options.config.git.repositoryPath,
        [...dedupedTests, ...manualHistoryTargets],
        {
          maxRevisions: options.config.git.maxRevisions,
          ...(options.config.git.commitUrlTemplate
            ? { commitUrlTemplate: options.config.git.commitUrlTemplate }
            : {})
        }
      )
    : undefined;
  if (gitResult)
    for (const test of dedupedTests) test.definitionHistory = gitResult.histories.get(test.id);
  if (gitResult)
    for (const item of uniqueManualCases) item.definitionHistory = gitResult.histories.get(item.id);
  const normalizedIdentityDiagnostics = calculateIdentityDiagnostics(dedupedTests, warnings);
  const catalogueInput = {
    tests: dedupedTests,
    manualCases: uniqueManualCases,
    manualExecutions: officialManualExecutions,
    metadata: meta,
    identityDiagnostics: normalizedIdentityDiagnostics
  };
  const testCaseCatalogue = deriveTestCaseCatalogue(catalogueInput);
  const catalogueConflicts = testCaseCatalogue
    .filter((entry) => entry.identity.conflict)
    .map((entry) => entry.canonicalId);
  const compatibleMultiImplementations = testCaseCatalogue
    .filter((entry) => !entry.identity.conflict && entry.implementations.length > 1)
    .map((entry) => entry.canonicalId);
  const identityDiagnostics = {
    ...normalizedIdentityDiagnostics,
    ...(() => {
      const conflictingCanonicalIds = [
        ...new Set([
          ...normalizedIdentityDiagnostics.conflictingCanonicalIds,
          ...catalogueConflicts
        ])
      ].sort();
      const conflictingSet = new Set(conflictingCanonicalIds);
      const multiImplementationCanonicalIds = [
        ...new Set([
          ...normalizedIdentityDiagnostics.multiImplementationCanonicalIds,
          ...compatibleMultiImplementations
        ])
      ]
        .filter((canonicalId) => !conflictingSet.has(canonicalId))
        .sort();
      return {
        conflictingCanonicalIds,
        multiImplementationCanonicalIds,
        duplicateCanonicalIds: conflictingCanonicalIds
      };
    })(),
    duplicateExplicitIds: normalizedIdentityDiagnostics.duplicateExplicitIds.filter(
      (canonicalId) =>
        catalogueConflicts.includes(canonicalId) ||
        normalizedIdentityDiagnostics.conflictingCanonicalIds.includes(canonicalId)
    )
  };
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
    warnings,
    manualCases: uniqueManualCases,
    manualExecutions: officialManualExecutions,
    releaseScope,
    readiness,
    git: gitResult?.repository,
    identityDiagnostics,
    testCaseCatalogue,
    unifiedExecutions: deriveUnifiedExecutions(catalogueInput)
  });

  if (releaseScope) {
    const releaseScopeFile = "release-scope.json";
    await writeFile(
      path.join(options.outputPath, releaseScopeFile),
      `${JSON.stringify(releaseScope, null, 2)}\n`
    );
    report.downloads.push({
      id: stableId(["download", "release-scope"]),
      name: "Normalized release scope",
      category: "requirements",
      path: releaseScopeFile,
      sizeBytes: (await stat(path.join(options.outputPath, releaseScopeFile))).size
    });
  }
  if (options.zip) {
    report.downloads.push({
      id: stableId(["download", "quality-report.zip"]),
      name: "Full generated report ZIP",
      category: "report",
      path: "quality-report.zip"
    });
  }

  await copyUi(options.outputPath);
  await writeData(options.outputPath, report);
  const prCommentMarker = options.prCommentMarker ?? DEFAULT_PR_COMMENT_MARKER;
  await writeMeta(options.outputPath, report, prCommentMarker);
  await writeProjectSummary(options.outputPath, report, options.config.project.reportUrl);
  await writeFile(
    path.join(options.outputPath, "normalized-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeEvidence(options.outputPath, report);
  if (options.zip) {
    const zipPath = path.join(options.outputPath, "quality-report.zip");
    const tmpZip = path.join(path.dirname(options.outputPath), `quality-report-${Date.now()}.zip`);
    await zipDirectory(options.outputPath, tmpZip);
    await rename(tmpZip, zipPath);
  }
  return report;
}
