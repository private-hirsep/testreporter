import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { buildReport } from "../src/generator.js";
import { buildPortfolio } from "../src/portfolio.js";
import {
  loadHistoryDirectory,
  mergeHistoryDirectory,
  resolveContainedPath,
  safeHistoryFilename
} from "../src/history.js";

describe("history filesystem", () => {
  it("uses collision-safe deterministic filenames", () => {
    expect(safeHistoryFilename("run/a", "run")).not.toBe(
      safeHistoryFilename("run:a", "run")
    );
    expect(safeHistoryFilename(`${"same".repeat(50)}a`, "run")).not.toBe(
      safeHistoryFilename(`${"same".repeat(50)}b`, "run")
    );
    expect(safeHistoryFilename("測試", "run")).toMatch(/^run-[a-f0-9]{12}\.json$/);
    expect(safeHistoryFilename("///", "manual")).toMatch(/^manual-[a-f0-9]{12}\.json$/);
    expect(safeHistoryFilename("same", "run")).toBe(safeHistoryFilename("same", "run"));
  });

  it.each([
    "../../file.json",
    "C:\\outside\\file.json",
    "/outside/file.json",
    "manual-executions/file.json",
    "runs/file.txt"
  ])("rejects unsafe run reference %s", (reference) => {
    expect(() => resolveContainedPath("C:\\history\\v1", reference, "runs")).toThrow(
      /unsafe|escapes/i
    );
  });

  it("round-trips an initial store and rejects unsafe index input", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-history-"));
    const output = path.join(temp, "site");
    const history = path.join(temp, "history");
    const config = await loadConfig(path.resolve("examples/minimal/quality-report.yml"));
    await buildReport({
      config,
      configPath: path.resolve("examples/minimal/quality-report.yml"),
      inputPath: path.resolve("examples/minimal/quality-artifacts"),
      outputPath: output
    });
    const reportFile = path.join(output, "normalized-report.json");
    const normalized = JSON.parse(await readFile(reportFile, "utf8")) as {
      manualExecutions: unknown[];
      unifiedExecutions?: Array<{ type: string }>;
    };
    normalized.manualExecutions = [];
    normalized.unifiedExecutions = normalized.unifiedExecutions?.filter(
      (item) => item.type !== "manual"
    );
    await writeFile(reportFile, JSON.stringify(normalized));
    await mergeHistoryDirectory({
      currentReport: reportFile,
      outputDir: history,
      staticOutput: path.join(output, "data/history.json"),
      projectSummaryOutput: path.join(output, "project-quality-summary.json")
    });
    const loaded = await loadHistoryDirectory(history);
    expect(loaded?.runs).toHaveLength(1);
    const indexFile = path.join(history, "v1/index.json");
    const index = JSON.parse(await readFile(indexFile, "utf8")) as {
      runs: Array<{ file: string }>;
    };
    index.runs[0]!.file = "../../outside.json";
    await writeFile(indexFile, JSON.stringify(index));
    await expect(loadHistoryDirectory(history)).rejects.toThrow(/unsafe/i);
    const unsafeBefore = await readFile(indexFile, "utf8");
    await expect(
      mergeHistoryDirectory({
        historyDir: history,
        currentReport: reportFile,
        outputDir: history
      })
    ).rejects.toThrow(/unsafe/i);
    expect(await readFile(indexFile, "utf8")).toBe(unsafeBefore);
  });

  it("diagnoses a missing referenced file without escaping the store", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-history-missing-"));
    await mkdir(path.join(temp, "v1"), { recursive: true });
    await writeFile(
      path.join(temp, "v1/index.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        project: { key: "DEMO", name: "Demo" },
        generatedAt: "2026-01-01T00:00:00.000Z",
        retention: {
          maxRuns: 50,
          maxAgeDays: 180,
          maxManualExecutions: 200,
          prunedRuns: 0,
          prunedManualExecutions: 0
        },
        runs: [
          {
            id: "missing",
            file: "runs/missing.json",
            reportedAt: "2026-01-01T00:00:00.000Z"
          }
        ],
        manualExecutions: [],
        diagnostics: []
      })
    );
    const loaded = await loadHistoryDirectory(temp);
    expect(loaded?.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HISTORY_FILE_MISSING" })
    );
  });

  it("writes real historical summary metrics consumed by portfolio actions", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "quality-history-summary-"));
    const site = path.join(temp, "site");
    const historyDir = path.join(temp, "history");
    const config = await loadConfig(path.resolve("examples/failing/quality-report.yml"));
    await buildReport({
      config,
      configPath: path.resolve("examples/failing/quality-report.yml"),
      inputPath: path.resolve("examples/minimal/quality-artifacts"),
      outputPath: site
    });
    const reportFile = path.join(site, "normalized-report.json");
    const first = JSON.parse(await readFile(reportFile, "utf8")) as {
      metadata: { runId?: string; generatedAt: string };
      unifiedExecutions: Array<{
        type: string;
        id: string;
        reportedAt?: string;
        caseResults: Array<{ status: string }>;
        counts: { passed: number; failed: number; broken?: number };
        status: string;
      }>;
      manualExecutions: unknown[];
    };
    first.manualExecutions = [];
    first.metadata.runId = "summary-one";
    const automated = first.unifiedExecutions.find((item) => item.type === "automated")!;
    automated.id = "summary-one";
    for (const result of automated.caseResults) result.status = "passed";
    automated.counts.passed = automated.caseResults.length;
    automated.counts.failed = 0;
    automated.counts.broken = 0;
    automated.status = "passed";
    await writeFile(reportFile, JSON.stringify(first));
    await mergeHistoryDirectory({ currentReport: reportFile, outputDir: historyDir });

    const second = structuredClone(first);
    second.metadata.runId = "summary-two";
    second.metadata.generatedAt = "2026-07-24T00:00:00.000Z";
    const secondAutomated = second.unifiedExecutions.find((item) => item.type === "automated")!;
    secondAutomated.id = "summary-two";
    secondAutomated.reportedAt = second.metadata.generatedAt;
    secondAutomated.caseResults[0]!.status = "failed";
    secondAutomated.counts.passed--;
    secondAutomated.counts.failed = 1;
    secondAutomated.status = "failed";
    await writeFile(reportFile, JSON.stringify(second));
    await mergeHistoryDirectory({
      historyDir,
      currentReport: reportFile,
      outputDir: historyDir,
      staticOutput: path.join(site, "data/history.json"),
      projectSummaryOutput: path.join(site, "project-quality-summary.json")
    });
    const summary = JSON.parse(
      await readFile(path.join(site, "project-quality-summary.json"), "utf8")
    ) as { history: { newFailures: number; sparkline: unknown[] } };
    expect(summary.history.newFailures).toBe(1);
    expect(summary.history.sparkline).toHaveLength(2);
    const summaries = path.join(temp, "summaries");
    await mkdir(summaries);
    await writeFile(
      path.join(summaries, "project-quality-summary.json"),
      JSON.stringify(summary)
    );
    const portfolio = path.join(temp, "portfolio");
    await buildPortfolio(summaries, portfolio, 7, new Date("2026-07-24T01:00:00.000Z"));
    expect(await readFile(path.join(portfolio, "index.html"), "utf8")).toContain(
      "Investigate 1 newly failing case(s)"
    );
  });
});
