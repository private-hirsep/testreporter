import { XMLParser } from "fast-xml-parser";
import type { CoverageSummary, TestLayer } from "@quality-report/report-core";
import { metric, numberOrUndefined, pct, toArray } from "./helpers.js";
import type { CoverageParseResult, ParseContext } from "./types.js";

type XmlRecord = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text"
});

function empty(layer: TestLayer): CoverageSummary {
  return { layer, files: [], rawLinks: [] };
}

function layer(context: ParseContext): TestLayer {
  return context.layer ?? "unknown";
}

function counterMap(counters: XmlRecord | XmlRecord[] | undefined) {
  const output: Record<string, ReturnType<typeof metric>> = {};
  for (const counter of toArray(counters)) {
    const type = String(counter.type ?? "").toLowerCase();
    const missed = numberOrUndefined(counter.missed) ?? 0;
    const covered = numberOrUndefined(counter.covered) ?? 0;
    if (type) output[type] = metric(covered, missed);
  }
  return output;
}

export function parseJaCoCoXml(content: string, context: ParseContext): CoverageParseResult {
  const doc = parser.parse(content) as XmlRecord;
  const report = doc.report as XmlRecord | undefined;
  const counters = counterMap(report?.counter as XmlRecord | XmlRecord[] | undefined);
  const files = toArray(report?.package as XmlRecord | XmlRecord[] | undefined).flatMap((pkg) => {
    const packageName = typeof pkg.name === "string" ? pkg.name : undefined;
    return toArray(pkg.sourcefile as XmlRecord | XmlRecord[] | undefined).map((file) => {
      const fileCounters = counterMap(file.counter as XmlRecord | XmlRecord[] | undefined);
      return {
        path: [packageName, file.name].filter(Boolean).join("/"),
        ...(packageName ? { packageName } : {}),
        instructions: fileCounters.instruction,
        branches: fileCounters.branch,
        lines: fileCounters.line,
        methods: fileCounters.method
      };
    });
  });
  return {
    items: [
      {
        ...empty(layer(context)),
        instructions: counters.instruction,
        branches: counters.branch,
        lines: counters.line,
        methods: counters.method,
        files
      }
    ],
    warnings: []
  };
}

export function parseCoberturaXml(content: string, context: ParseContext): CoverageParseResult {
  const doc = parser.parse(content) as XmlRecord;
  const coverage = doc.coverage as XmlRecord | undefined;
  const lineRate = numberOrUndefined(coverage?.["line-rate"]);
  const branchRate = numberOrUndefined(coverage?.["branch-rate"]);
  return {
    items: [
      {
        ...empty(layer(context)),
        lines: lineRate !== undefined ? { percentage: Math.round(lineRate * 10000) / 100 } : undefined,
        branches: branchRate !== undefined ? { percentage: Math.round(branchRate * 10000) / 100 } : undefined
      }
    ],
    warnings: []
  };
}

export function parseJaCoCoCsv(content: string, context: ParseContext): CoverageParseResult {
  const lines = content.trim().split(/\r?\n/);
  const [header, ...rows] = lines;
  const headers = header?.split(",") ?? [];
  const totals = { instructionMissed: 0, instructionCovered: 0, branchMissed: 0, branchCovered: 0 };
  for (const row of rows) {
    const cols = row.split(",");
    const get = (name: string) => Number(cols[headers.indexOf(name)] ?? 0);
    totals.instructionMissed += get("INSTRUCTION_MISSED");
    totals.instructionCovered += get("INSTRUCTION_COVERED");
    totals.branchMissed += get("BRANCH_MISSED");
    totals.branchCovered += get("BRANCH_COVERED");
  }
  return {
    items: [
      {
        ...empty(layer(context)),
        instructions: metric(totals.instructionCovered, totals.instructionMissed),
        branches: metric(totals.branchCovered, totals.branchMissed)
      }
    ],
    warnings: []
  };
}

export function parseIstanbulSummary(content: string, context: ParseContext): CoverageParseResult {
  const json = JSON.parse(content) as JsonRecord;
  const total = json.total as JsonRecord | undefined;
  const item = (name: string) => {
    const value = total?.[name] as JsonRecord | undefined;
    const covered = numberOrUndefined(value?.covered);
    const all = numberOrUndefined(value?.total);
    return {
      covered,
      total: all,
      missed: covered !== undefined && all !== undefined ? all - covered : undefined,
      percentage: numberOrUndefined(value?.pct)
    };
  };
  return {
    items: [
      {
        ...empty(layer(context)),
        lines: item("lines"),
        statements: item("statements"),
        branches: item("branches"),
        functions: item("functions")
      }
    ],
    warnings: []
  };
}

export function parseLcov(content: string, context: ParseContext): CoverageParseResult {
  const files = content.split("end_of_record").filter((record) => record.trim().length > 0);
  let found = 0;
  let hit = 0;
  let branchesFound = 0;
  let branchesHit = 0;
  const fileCoverage = [];

  for (const record of files) {
    const sourceFile = record.match(/^SF:(.+)$/m)?.[1] ?? "unknown";
    const lf = Number(record.match(/^LF:(\d+)$/m)?.[1] ?? 0);
    const lh = Number(record.match(/^LH:(\d+)$/m)?.[1] ?? 0);
    const brf = Number(record.match(/^BRF:(\d+)$/m)?.[1] ?? 0);
    const brh = Number(record.match(/^BRH:(\d+)$/m)?.[1] ?? 0);
    found += lf;
    hit += lh;
    branchesFound += brf;
    branchesHit += brh;
    fileCoverage.push({
      path: sourceFile,
      lines: { covered: lh, total: lf, missed: lf - lh, percentage: pct(lh, lf) },
      branches: { covered: brh, total: brf, missed: brf - brh, percentage: pct(brh, brf) }
    });
  }

  return {
    items: [
      {
        ...empty(layer(context)),
        lines: { covered: hit, total: found, missed: found - hit, percentage: pct(hit, found) },
        branches: {
          covered: branchesHit,
          total: branchesFound,
          missed: branchesFound - branchesHit,
          percentage: pct(branchesHit, branchesFound)
        },
        files: fileCoverage
      }
    ],
    warnings: []
  };
}
