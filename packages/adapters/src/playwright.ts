import { buildTestCase, numberOrUndefined, toArray } from "./helpers.js";
import type { ParseContext, TestParseResult } from "./types.js";
import type { NormalizedTestCase } from "@quality-report/report-core";

type JsonRecord = Record<string, unknown>;

function visitSuite(suite: JsonRecord, context: ParseContext, parent: string[] = []): NormalizedTestCase[] {
  const title = typeof suite.title === "string" && suite.title ? [...parent, suite.title] : parent;
  const tests = toArray(suite.tests as JsonRecord[] | JsonRecord | undefined).flatMap((test) => {
    const results = toArray(test.results as JsonRecord[] | JsonRecord | undefined);
    const latest = results.at(-1) ?? {};
    const status = String(latest.status ?? test.outcome ?? "unknown");
    const error = toArray(latest.errors as JsonRecord[] | JsonRecord | undefined)[0];
    const annotations = toArray(test.annotations as JsonRecord[] | JsonRecord | undefined);
    const labels: Record<string, string[]> = {};
    for (const annotation of annotations) {
      const type = typeof annotation.type === "string" ? annotation.type : "annotation";
      const description =
        typeof annotation.description === "string" ? annotation.description : String(annotation.description ?? "");
      labels[type] = [...(labels[type] ?? []), description].filter(Boolean);
    }
    const name = typeof test.title === "string" ? test.title : "unnamed playwright test";
    return [
      buildTestCase({
        name,
        suite: title.join(" > ") || undefined,
        file: typeof test.location === "object" ? String((test.location as JsonRecord).file ?? "") : undefined,
        line:
          typeof test.location === "object" ? numberOrUndefined((test.location as JsonRecord).line) : undefined,
        framework: "playwright",
        layer: context.layer ?? "e2e",
        status:
          status === "passed"
            ? "passed"
            : status === "skipped"
              ? "skipped"
              : status === "failed" || status === "timedOut"
                ? "failed"
                : "unknown",
        durationMs: numberOrUndefined(latest.duration),
        message: typeof error?.message === "string" ? error.message : undefined,
        trace: typeof error?.stack === "string" ? error.stack : undefined,
        labels,
        requirementPattern: context.requirementPattern,
        sourcePath: context.sourcePath
      })
    ];
  });
  const childTests: NormalizedTestCase[] = toArray(suite.suites as JsonRecord[] | JsonRecord | undefined).flatMap((child) =>
    visitSuite(child, context, title)
  );
  return [...tests, ...childTests];
}

export function parsePlaywrightJson(content: string, context: ParseContext): TestParseResult {
  const json = JSON.parse(content) as JsonRecord;
  const items = toArray(json.suites as JsonRecord[] | JsonRecord | undefined).flatMap((suite) =>
    visitSuite(suite, context)
  );
  return { items, warnings: [] };
}
