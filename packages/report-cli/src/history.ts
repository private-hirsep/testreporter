import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  HistoricalManualExecutionSummarySchema,
  HistoricalRunSummarySchema,
  ProjectHistoryStoreSchema,
  deriveHistoryArtifact,
  mergeProjectHistory,
  type HistoryDiagnostic,
  type HistoryOptions,
  type NormalizedReport,
  NormalizedReportSchema,
  type ProjectHistoryStore
} from "@quality-report/report-core";

type HistoryIndex = {
  schemaVersion: "1.0";
  project: { key: string; name: string };
  generatedAt: string;
  retention: ProjectHistoryStore["retention"];
  runs: Array<{ id: string; file: string; reportedAt: string }>;
  manualExecutions: Array<{ executionId: string; file: string; completedAt: string }>;
  diagnostics: HistoryDiagnostic[];
};

const safeFileName = (id: string) =>
  `${id.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "item"}.json`;

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export async function loadHistoryDirectory(directory: string): Promise<ProjectHistoryStore | undefined> {
  const root = path.join(directory, "v1");
  const indexFile = path.join(root, "index.json");
  if (!(await exists(indexFile))) return undefined;
  const index = JSON.parse(await readFile(indexFile, "utf8")) as HistoryIndex;
  if (index.schemaVersion !== "1.0")
    throw new Error(`Unsupported history schema version: ${String(index.schemaVersion)}`);
  const diagnostics = [...(index.diagnostics ?? [])];
  const runs = [];
  for (const reference of [...index.runs].sort((a, b) => a.file.localeCompare(b.file))) {
    const file = path.join(root, reference.file);
    if (!(await exists(file))) {
      diagnostics.push({
        severity: "error",
        code: "HISTORY_FILE_MISSING",
        message: `Referenced run file is missing: ${reference.file}`,
        artifact: reference.file
      });
      continue;
    }
    runs.push(HistoricalRunSummarySchema.parse(JSON.parse(await readFile(file, "utf8"))));
  }
  const manualExecutions = [];
  for (const reference of [...index.manualExecutions].sort((a, b) => a.file.localeCompare(b.file))) {
    const file = path.join(root, reference.file);
    if (!(await exists(file))) {
      diagnostics.push({
        severity: "error",
        code: "HISTORY_FILE_MISSING",
        message: `Referenced manual execution file is missing: ${reference.file}`,
        artifact: reference.file
      });
      continue;
    }
    manualExecutions.push(
      HistoricalManualExecutionSummarySchema.parse(JSON.parse(await readFile(file, "utf8")))
    );
  }
  return ProjectHistoryStoreSchema.parse({ ...index, runs, manualExecutions, diagnostics });
}

async function writeHistoryDirectory(directory: string, store: ProjectHistoryStore) {
  const root = path.join(directory, "v1");
  const runsDir = path.join(root, "runs");
  const manualDir = path.join(root, "manual-executions");
  await mkdir(runsDir, { recursive: true });
  await mkdir(manualDir, { recursive: true });
  const runReferences = [];
  for (const run of store.runs) {
    const file = `runs/${safeFileName(run.id)}`;
    await writeFile(path.join(root, file), `${JSON.stringify(run, null, 2)}\n`);
    runReferences.push({ id: run.id, file, reportedAt: run.reportedAt });
  }
  const manualReferences = [];
  for (const execution of store.manualExecutions) {
    const file = `manual-executions/${safeFileName(execution.executionId)}`;
    await writeFile(path.join(root, file), `${JSON.stringify(execution, null, 2)}\n`);
    manualReferences.push({
      executionId: execution.executionId,
      file,
      completedAt: execution.completedAt
    });
  }
  const index: HistoryIndex = {
    schemaVersion: "1.0",
    project: store.project,
    generatedAt: store.generatedAt,
    retention: store.retention,
    runs: runReferences,
    manualExecutions: manualReferences,
    diagnostics: store.diagnostics
  };
  await writeFile(path.join(root, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
}

export async function mergeHistoryDirectory(options: {
  historyDir?: string;
  currentReport: string;
  outputDir: string;
  staticOutput?: string;
  retention?: HistoryOptions;
  sourceReportUrl?: string;
}) {
  const report = NormalizedReportSchema.parse(
    JSON.parse(await readFile(options.currentReport, "utf8"))
  ) as NormalizedReport;
  const existing = options.historyDir
    ? await loadHistoryDirectory(options.historyDir)
    : undefined;
  const store = mergeProjectHistory(
    existing,
    report,
    options.retention,
    options.sourceReportUrl
  );
  const parent = path.dirname(path.resolve(options.outputDir));
  const temporary = path.join(
    parent,
    `.${path.basename(options.outputDir)}-${process.pid}-${Date.now()}.tmp`
  );
  await rm(temporary, { recursive: true, force: true });
  await writeHistoryDirectory(temporary, store);
  await rm(options.outputDir, { recursive: true, force: true });
  await rename(temporary, options.outputDir);
  if (options.staticOutput) {
    await mkdir(path.dirname(options.staticOutput), { recursive: true });
    await writeFile(
      options.staticOutput,
      `${JSON.stringify(deriveHistoryArtifact(store, options.retention), null, 2)}\n`
    );
  }
  return store;
}
