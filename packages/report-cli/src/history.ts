import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";

import {
  HistoricalManualExecutionSummarySchema,
  HistoricalRunSummarySchema,
  ProjectHistoryStoreSchema,
  deriveHistoryArtifact,
  mergeProjectHistory,
  type HistoryOptions,
  type NormalizedReport,
  NormalizedReportSchema,
  type ProjectHistoryStore
} from "@quality-report/report-core";
import { writeEvidence, writeProjectSummary } from "./evidence.js";

const HistoryIndexSchema = z.object({
  schemaVersion: z.literal("1.0"),
  project: z.object({ key: z.string().min(1), name: z.string().min(1) }),
  generatedAt: z.string().datetime(),
  retention: z.object({
    maxRuns: z.number().int().positive(),
    maxAgeDays: z.number().int().positive(),
    maxManualExecutions: z.number().int().positive(),
    prunedRuns: z.number().int().nonnegative(),
    prunedManualExecutions: z.number().int().nonnegative()
  }),
  runs: z.array(
    z.object({ id: z.string(), file: z.string(), reportedAt: z.string().datetime() })
  ),
  manualExecutions: z.array(
    z.object({ executionId: z.string(), file: z.string(), completedAt: z.string().datetime() })
  ),
  diagnostics: z.array(
    z.object({
      severity: z.enum(["error", "warning", "information"]),
      code: z.string(),
      message: z.string(),
      artifact: z.string().optional()
    })
  )
});
type HistoryIndex = z.infer<typeof HistoryIndexSchema>;

export function safeHistoryFilename(id: string, kind: "run" | "manual") {
  const readable =
    id
      .normalize("NFKD")
      .replace(/[^\p{ASCII}]/gu, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || kind;
  const hash = createHash("sha256").update(id, "utf8").digest("hex").slice(0, 12);
  return `${readable}-${hash}.json`;
}

export function resolveContainedPath(
  root: string,
  relativePath: string,
  expectedDirectory: "runs" | "manual-executions"
) {
  if (
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..") ||
    !relativePath.startsWith(`${expectedDirectory}/`) ||
    !relativePath.endsWith(".json")
  )
    throw new Error(`Unsafe history path: ${relativePath}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`))
    throw new Error(`History path escapes root: ${relativePath}`);
  return resolved;
}

function assertUniqueReferences(
  references: Array<{ file: string; id: string }>,
  label: string
) {
  const files = new Set<string>();
  const ids = new Set<string>();
  for (const reference of references) {
    if (files.has(reference.file)) throw new Error(`Duplicate ${label} path: ${reference.file}`);
    if (ids.has(reference.id)) throw new Error(`Duplicate ${label} ID: ${reference.id}`);
    files.add(reference.file);
    ids.add(reference.id);
  }
}

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlinkEscape(root: string, file: string) {
  const actualRoot = await realpath(root);
  const actualFile = await realpath(file);
  if (!actualFile.startsWith(`${actualRoot}${path.sep}`))
    throw new Error(`History path escapes root through a symbolic link: ${file}`);
}

export async function loadHistoryDirectory(directory: string): Promise<ProjectHistoryStore | undefined> {
  const root = path.join(directory, "v1");
  const indexFile = path.join(root, "index.json");
  if (!(await exists(indexFile))) return undefined;
  const index = HistoryIndexSchema.parse(JSON.parse(await readFile(indexFile, "utf8")));
  assertUniqueReferences(
    index.runs.map((item) => ({ id: item.id, file: item.file })),
    "run reference"
  );
  assertUniqueReferences(
    index.manualExecutions.map((item) => ({ id: item.executionId, file: item.file })),
    "manual reference"
  );
  const diagnostics = [...(index.diagnostics ?? [])];
  const runs = [];
  for (const reference of [...index.runs].sort((a, b) => a.file.localeCompare(b.file))) {
    const file = resolveContainedPath(root, reference.file, "runs");
    if (!(await exists(file))) {
      diagnostics.push({
        severity: "error",
        code: "HISTORY_FILE_MISSING",
        message: `Referenced run file is missing: ${reference.file}`,
        artifact: reference.file
      });
      continue;
    }
    await assertNoSymlinkEscape(root, file);
    const run = HistoricalRunSummarySchema.parse(JSON.parse(await readFile(file, "utf8")));
    if (run.id !== reference.id)
      throw new Error(`History run ID mismatch: index ${reference.id}, file ${run.id}.`);
    if (run.projectKey !== index.project.key)
      throw new Error(`History run ${run.id} belongs to another project.`);
    runs.push(run);
  }
  const manualExecutions = [];
  for (const reference of [...index.manualExecutions].sort((a, b) => a.file.localeCompare(b.file))) {
    const file = resolveContainedPath(root, reference.file, "manual-executions");
    if (!(await exists(file))) {
      diagnostics.push({
        severity: "error",
        code: "HISTORY_FILE_MISSING",
        message: `Referenced manual execution file is missing: ${reference.file}`,
        artifact: reference.file
      });
      continue;
    }
    await assertNoSymlinkEscape(root, file);
    const execution = HistoricalManualExecutionSummarySchema.parse(
      JSON.parse(await readFile(file, "utf8"))
    );
    if (execution.executionId !== reference.executionId)
      throw new Error(
        `Manual execution ID mismatch: index ${reference.executionId}, file ${execution.executionId}.`
      );
    if (execution.projectKey !== index.project.key)
      throw new Error(`Manual execution ${execution.executionId} belongs to another project.`);
    manualExecutions.push(execution);
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
  const generatedFiles = new Set<string>();
  for (const run of store.runs) {
    const file = `runs/${safeHistoryFilename(run.id, "run")}`;
    if (generatedFiles.has(file)) throw new Error(`History filename collision: ${file}`);
    generatedFiles.add(file);
    await writeFile(path.join(root, file), `${JSON.stringify(run, null, 2)}\n`);
    runReferences.push({ id: run.id, file, reportedAt: run.reportedAt });
  }
  const manualReferences = [];
  for (const execution of store.manualExecutions) {
    const file = `manual-executions/${safeHistoryFilename(execution.executionId, "manual")}`;
    if (generatedFiles.has(file)) throw new Error(`History filename collision: ${file}`);
    generatedFiles.add(file);
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
  projectSummaryOutput?: string;
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
  const backup = `${path.resolve(options.outputDir)}.backup-${process.pid}-${Date.now()}`;
  const hadOutput = await exists(options.outputDir);
  try {
    if (hadOutput) await rename(options.outputDir, backup);
    await rename(temporary, options.outputDir);
    if (hadOutput) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (!(await exists(options.outputDir)) && (await exists(backup)))
      await rename(backup, options.outputDir);
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  if (options.staticOutput) {
    await mkdir(path.dirname(options.staticOutput), { recursive: true });
    await writeFile(
      options.staticOutput,
      `${JSON.stringify(deriveHistoryArtifact(store, options.retention), null, 2)}\n`
    );
  }
  if (options.projectSummaryOutput) {
    await mkdir(path.dirname(options.projectSummaryOutput), { recursive: true });
    const summary = await writeProjectSummary(
      path.dirname(options.projectSummaryOutput),
      report,
      options.sourceReportUrl,
      deriveHistoryArtifact(store, options.retention)
    );
    if (path.basename(options.projectSummaryOutput) !== "project-quality-summary.json")
      await writeFile(options.projectSummaryOutput, `${JSON.stringify(summary, null, 2)}\n`);
    await writeEvidence(path.dirname(options.projectSummaryOutput), report);
  }
  return store;
}
