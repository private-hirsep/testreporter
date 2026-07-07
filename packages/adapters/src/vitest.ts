import { buildTestCase, numberOrUndefined, toArray } from "./helpers.js";
import type { ParseContext, TestParseResult } from "./types.js";
import type { NormalizedTestCase } from "@quality-report/report-core";

type JsonRecord = Record<string, unknown>;

function visit(task: JsonRecord, context: ParseContext, suite: string[] = []): NormalizedTestCase[] {
  const type = String(task.type ?? "");
  const name = typeof task.name === "string" ? task.name : typeof task.filepath === "string" ? task.filepath : "";
  if (type === "suite" || task.tasks) {
    return toArray(task.tasks as JsonRecord[] | JsonRecord | undefined).flatMap((child) =>
      visit(child, context, name ? [...suite, name] : suite)
    );
  }
  const result = task.result as JsonRecord | undefined;
  const state = String(result?.state ?? task.mode ?? "unknown");
  return [
    buildTestCase({
      name: name || "unnamed vitest test",
      suite: suite.join(" > ") || undefined,
      file: typeof task.filepath === "string" ? task.filepath : undefined,
      framework: "vitest",
      layer: context.layer ?? "frontend",
      status:
        state === "pass"
          ? "passed"
          : state === "fail"
            ? "failed"
            : state === "skip" || state === "todo"
              ? "skipped"
              : "unknown",
      durationMs: numberOrUndefined(result?.duration),
      message: typeof result?.error === "object" ? String((result.error as JsonRecord).message ?? "") : undefined,
      trace: typeof result?.error === "object" ? String((result.error as JsonRecord).stack ?? "") : undefined,
      labels: {},
      requirementPattern: context.requirementPattern,
      sourcePath: context.sourcePath
    })
  ];
}

export function parseVitestJson(content: string, context: ParseContext): TestParseResult {
  const json = JSON.parse(content) as JsonRecord;
  const roots = toArray((json.testResults ?? json.files ?? json.tasks) as JsonRecord[] | JsonRecord | undefined);
  const items = roots.flatMap((root) => visit(root, context));
  return { items, warnings: [] };
}
