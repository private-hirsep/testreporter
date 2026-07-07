import path from "node:path";
import fg from "fast-glob";
import { asArray, type QualityReportConfig, type TestLayer } from "@quality-report/report-core";

export type ArtifactKind =
  | "junit"
  | "vitestJson"
  | "playwrightJson"
  | "jacocoXml"
  | "jacocoCsv"
  | "coberturaXml"
  | "lcov"
  | "istanbulSummary"
  | "sarif"
  | "zapJson"
  | "expectedRequirements"
  | "requirementMapping"
  | "rawHtml";

export type DiscoveredArtifact = {
  kind: ArtifactKind;
  layer?: TestLayer;
  path: string;
};

async function expand(patterns: string[], cwd: string): Promise<string[]> {
  if (patterns.length === 0) return [];
  return fg(patterns, { cwd, absolute: true, onlyFiles: false, dot: true, unique: true });
}

function rel(input: string) {
  return path.resolve(input);
}

export async function discoverArtifacts(
  config: QualityReportConfig,
  inputPath: string
): Promise<DiscoveredArtifact[]> {
  const cwd = rel(inputPath);
  const artifacts: DiscoveredArtifact[] = [];
  const add = async (kind: ArtifactKind, patterns: string[], layer?: TestLayer) => {
    for (const file of await expand(patterns, cwd)) artifacts.push({ kind, path: file, ...(layer ? { layer } : {}) });
  };

  await add("junit", asArray(config.artifacts.tests?.backend?.junit), "backend");
  await add("junit", asArray(config.artifacts.tests?.backend?.pytestJunit), "backend");
  await add("junit", asArray(config.artifacts.tests?.frontend?.junit), "frontend");
  await add("vitestJson", asArray(config.artifacts.tests?.frontend?.vitestJson), "frontend");
  await add("junit", asArray(config.artifacts.tests?.e2e?.junit), "e2e");
  await add("playwrightJson", asArray(config.artifacts.tests?.e2e?.playwrightJson), "e2e");

  await add("jacocoXml", asArray(config.artifacts.coverage?.backend?.jacocoXml), "backend");
  await add("jacocoCsv", asArray(config.artifacts.coverage?.backend?.jacocoCsv), "backend");
  await add("coberturaXml", asArray(config.artifacts.coverage?.backend?.coberturaXml), "backend");
  await add("lcov", asArray(config.artifacts.coverage?.backend?.lcov), "backend");
  await add("istanbulSummary", asArray(config.artifacts.coverage?.backend?.summaryJson), "backend");
  await add("rawHtml", asArray(config.artifacts.coverage?.backend?.html), "backend");

  await add("jacocoXml", asArray(config.artifacts.coverage?.frontend?.jacocoXml), "frontend");
  await add("coberturaXml", asArray(config.artifacts.coverage?.frontend?.coberturaXml), "frontend");
  await add("lcov", asArray(config.artifacts.coverage?.frontend?.lcov), "frontend");
  await add("istanbulSummary", asArray(config.artifacts.coverage?.frontend?.summaryJson), "frontend");
  await add("rawHtml", asArray(config.artifacts.coverage?.frontend?.html), "frontend");

  await add("expectedRequirements", asArray(config.artifacts.requirements?.expectedKeys));
  await add("requirementMapping", asArray(config.artifacts.requirements?.mapping));
  await add("sarif", asArray(config.artifacts.security?.codeqlSarif));
  await add("zapJson", asArray(config.artifacts.security?.zapJson));
  await add("rawHtml", asArray(config.artifacts.raw));

  return artifacts;
}
