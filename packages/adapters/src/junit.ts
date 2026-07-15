import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { TestLayer } from "@quality-report/report-core";
import { buildTestCase, numberOrUndefined, parserWarning, toArray } from "./helpers.js";
import type { ParseContext, TestParseResult } from "./types.js";

type XmlRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  trimValues: false
});

function inferFramework(classname: string | undefined, ctxFramework: string | undefined) {
  if (ctxFramework === "pytest" || classname?.includes("pytest")) return "pytest";
  if (ctxFramework === "vitest") return "vitest";
  if (ctxFramework === "playwright") return "playwright";
  return "junit";
}

function statusOf(testcase: XmlRecord) {
  if (testcase.skipped !== undefined) return "skipped" as const;
  if (testcase.failure !== undefined) return "failed" as const;
  if (testcase.error !== undefined) return "broken" as const;
  return "passed" as const;
}

function errorOf(value: unknown): { message?: string; trace?: string } {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object") return {};
  const record = item as XmlRecord;
  return {
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(typeof record["#text"] === "string" ? { trace: record["#text"] as string } : {})
  };
}

function labelsOf(testcase: XmlRecord): Record<string, string[]> {
  const labels: Record<string, string[]> = {};
  const properties = testcase.properties as XmlRecord | undefined;
  for (const property of toArray(properties?.property as XmlRecord | XmlRecord[] | undefined)) {
    if (typeof property.name === "string" && property.value !== undefined) {
      labels[property.name] = [...(labels[property.name] ?? []), String(property.value)];
    }
  }
  return labels;
}

export function parseJUnitXml(xml: string, context: ParseContext): TestParseResult {
  const warnings = [];
  if (!xml.trim()) {
    return {
      items: [],
      warnings: [parserWarning(context.sourcePath, "junit.empty", "JUnit XML file is empty.")]
    };
  }
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return {
      items: [],
      warnings: [
        parserWarning(
          context.sourcePath,
          "junit.malformed",
          validation.err?.msg ?? "Malformed JUnit XML file."
        )
      ]
    };
  }
  const document = parser.parse(xml) as XmlRecord;
  const root = document.testsuites ?? document.testsuite;
  const suites =
    document.testsuites && typeof document.testsuites === "object"
      ? toArray((document.testsuites as XmlRecord).testsuite as XmlRecord | XmlRecord[])
      : toArray(root as XmlRecord | XmlRecord[]);

  const items = suites.flatMap((suite) => {
    const suiteName = typeof suite.name === "string" ? suite.name : undefined;
    return toArray(suite.testcase as XmlRecord | XmlRecord[] | undefined).map((testcase) => {
      const classname = typeof testcase.classname === "string" ? testcase.classname : suiteName;
      const name = typeof testcase.name === "string" ? testcase.name : "unnamed test";
      const failure = errorOf(testcase.failure);
      const error = errorOf(testcase.error);
      const labels = labelsOf(testcase);
      return buildTestCase({
        name,
        suite: classname,
        file: typeof testcase.file === "string" ? testcase.file : undefined,
        line: numberOrUndefined(testcase.line),
        framework: inferFramework(classname, context.framework) as ReturnType<
          typeof inferFramework
        >,
        layer: context.layer ?? ("unknown" as TestLayer),
        status: statusOf(testcase),
        durationMs: Math.round((numberOrUndefined(testcase.time) ?? 0) * 1000),
        message: failure.message ?? error.message,
        trace: failure.trace ?? error.trace,
        labels,
        requirementPattern: context.requirementPattern,
        identityPattern: context.identityPattern,
        titleTokenPattern: context.titleTokenPattern,
        annotationAliases: context.annotationAliases,
        defectPattern: context.defectPattern,
        sourcePath: context.sourcePath
      });
    });
  });

  if (items.length === 0) {
    warnings.push({
      sourcePath: context.sourcePath,
      code: "junit.no-tests",
      message: "No test cases found in JUnit XML file."
    });
  }
  return { items, warnings };
}
