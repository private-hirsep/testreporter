import { describe, expect, it } from "vitest";
import {
  parseIstanbulSummary,
  parseJaCoCoCsv,
  parseJaCoCoXml,
  parseJUnitXml,
  parseLcov,
  parsePlaywrightJson,
  parseSarif,
  parseVitestJson,
  parseZapJson
} from "../src/index.js";

const context = {
  sourcePath: "sample",
  layer: "backend" as const,
  requirementPattern: /[A-Z]+-[0-9]+/g
};

describe("adapters", () => {
  it("parses JUnit XML roots, statuses, properties, durations, and requirements", () => {
    const result = parseJUnitXml(
      [
        "<testsuites>",
        '<testsuite name="Suite">',
        '<testcase classname="A" name="passes RFL-1" time="0.1" file="/home/runner/work/src/a.test.ts" line="7"><properties><property name="requirement" value="RFL-2"/></properties></testcase>',
        '<testcase classname="A" name="fails" time="0.2"><failure message="bad">trace</failure></testcase>',
        '<testcase classname="A" name="breaks"><error message="boom">stack</error></testcase>',
        '<testcase classname="A" name="skips"><skipped /></testcase>',
        "</testsuite>",
        "</testsuites>"
      ].join(""),
      context
    );
    expect(result.warnings).toEqual([]);
    expect(result.items.map((item) => item.status)).toEqual([
      "passed",
      "failed",
      "broken",
      "skipped"
    ]);
    expect(result.items[0]?.durationMs).toBe(100);
    expect(result.items[0]?.file).toBe("a.test.ts");
    expect(result.items[0]?.line).toBe(7);
    expect(result.items[0]?.labels.requirement).toEqual(["RFL-2"]);
    expect(result.items[0]?.requirements).toEqual(["RFL-1", "RFL-2"]);
    expect(result.items[1]?.error?.message).toBe("bad");
    expect(result.items[2]?.error?.trace).toBe("stack");
  });

  it("returns controlled warnings for empty and malformed JUnit XML", () => {
    expect(parseJUnitXml("", context).warnings[0]?.code).toBe("junit.empty");
    expect(parseJUnitXml("<testsuite><testcase></testsuite>", context).warnings[0]?.code).toBe(
      "junit.malformed"
    );
    expect(parseJUnitXml("<testsuite></testsuite>", context).warnings[0]?.code).toBe(
      "junit.no-tests"
    );
  });

  it("parses Playwright JSON with retries, metadata, attachments, errors, and requirements", () => {
    const result = parsePlaywrightJson(
      JSON.stringify({
        suites: [
          {
            title: "root",
            suites: [
              {
                title: "child",
                tests: [
                  {
                    title: "t RFL-2",
                    projectName: "chromium",
                    browserName: "chromium",
                    location: { file: "C:/work/repo/tests/e2e.spec.ts", line: 12 },
                    annotations: [{ type: "requirement", description: "RFL-3" }],
                    results: [
                      { status: "failed", retry: 0, errors: [{ message: "bad", stack: "stack" }] },
                      {
                        status: "passed",
                        retry: 1,
                        duration: 50,
                        attachments: [
                          {
                            name: "trace",
                            path: "/home/runner/trace.zip",
                            contentType: "application/zip"
                          }
                        ]
                      }
                    ]
                  },
                  { title: "skip", results: [{ status: "skipped" }] }
                ]
              }
            ]
          }
        ]
      }),
      { ...context, layer: "e2e" }
    );
    expect(result.items[0]?.framework).toBe("playwright");
    expect(result.items[0]?.status).toBe("passed");
    expect(result.items[0]?.retries).toBe(1);
    expect(result.items[0]?.labels.project).toEqual(["chromium"]);
    expect(result.items[0]?.requirements).toEqual(["RFL-2", "RFL-3"]);
    expect(result.items[0]?.file).toBe("e2e.spec.ts");
    expect(result.items[0]?.line).toBe(12);
    expect(result.items[0]?.attachments[0]?.path).toBe("trace.zip");
    expect(result.items[1]?.status).toBe("skipped");
    expect(parsePlaywrightJson("{", context).warnings[0]?.code).toBe("playwright.malformed");
    expect(parsePlaywrightJson("{}", context).warnings[0]?.code).toBe("playwright.no-tests");
  });

  it("parses Vitest JSON and warns for unexpected shapes", () => {
    const result = parseVitestJson(
      JSON.stringify({
        tasks: [
          {
            type: "suite",
            name: "suite",
            tasks: [
              {
                type: "test",
                name: "passes RFL-4",
                filepath: "/Users/peter/repo/a.test.ts",
                result: { state: "pass", duration: 3 }
              },
              {
                type: "test",
                name: "fails",
                result: { state: "fail", error: { message: "bad", stack: "stack" } }
              },
              { type: "test", name: "skips", result: { state: "skip" } }
            ]
          }
        ]
      }),
      { ...context, layer: "frontend" }
    );
    expect(result.items.map((item) => item.status)).toEqual(["passed", "failed", "skipped"]);
    expect(result.items[0]?.suite).toBe("suite");
    expect(result.items[0]?.file).toBe("a.test.ts");
    expect(result.items[0]?.durationMs).toBe(3);
    expect(result.items[1]?.error?.message).toBe("bad");
    expect(result.items[0]?.requirements).toEqual(["RFL-4"]);
    expect(parseVitestJson("{}", context).warnings[0]?.code).toBe("vitest.unexpected-shape");
    expect(parseVitestJson("{", context).warnings[0]?.code).toBe("vitest.malformed");
  });

  it("parses coverage formats", () => {
    const jacoco = parseJaCoCoXml(
      '<report><package name="com/example"><sourcefile name="A.java"><counter type="LINE" missed="2" covered="8"/></sourcefile></package><counter type="LINE" missed="1" covered="3"/></report>',
      context
    );
    expect(jacoco.items[0]?.lines?.percentage).toBe(75);
    expect(jacoco.items[0]?.files[0]?.path).toBe("com/example/A.java");
    expect(
      parseJaCoCoCsv(
        "GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED\napp,p,C,1,3,2,2",
        context
      ).items[0]?.instructions?.percentage
    ).toBe(75);
    expect(
      parseLcov(
        "SF:/home/runner/repo/a.ts\nDA:1,1\nLF:1\nLH:1\nBRF:1\nBRH:0\nend_of_record",
        context
      ).items[0]?.files[0]?.path
    ).toBe("a.ts");
    expect(
      parseIstanbulSummary(
        JSON.stringify({ total: { lines: { total: 2, covered: 1, pct: 50 } } }),
        context
      ).items[0]?.lines?.percentage
    ).toBe(50);
    expect(parseJaCoCoXml("<report>", context).warnings[0]?.code).toBe(
      "coverage.jacoco-xml.malformed"
    );
    expect(parseJaCoCoCsv("not,coverage\nx,y", context).warnings[0]?.code).toBe(
      "coverage.jacoco-csv.unexpected-shape"
    );
    expect(parseIstanbulSummary("{", context).warnings[0]?.code).toBe(
      "coverage.istanbul.malformed"
    );
    expect(parseIstanbulSummary("{}", context).warnings[0]?.code).toBe(
      "coverage.istanbul.unexpected-shape"
    );
  });

  it("parses SARIF and ZAP security findings", () => {
    const sarif = parseSarif(
      JSON.stringify({
        runs: [
          {
            tool: {
              driver: {
                rules: [
                  {
                    id: "r",
                    name: "Rule",
                    fullDescription: { text: "Rule description" },
                    help: { text: "Fix it" },
                    helpUri: "https://example.test/rule",
                    properties: {
                      "security-severity": "8.0",
                      precision: "high",
                      tags: ["security"]
                    }
                  }
                ]
              }
            },
            results: [
              {
                ruleId: "r",
                message: { text: "msg" },
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: "/home/runner/repo/src/a.ts" },
                      region: { startLine: 4 }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }),
      context
    );
    const zap = parseZapJson(
      JSON.stringify({
        site: [
          {
            alerts: [
              {
                alert: "A",
                riskdesc: "High",
                riskcode: "3",
                confidence: "2",
                cweid: "79",
                wascid: "8",
                solution: "Escape output",
                instances: [{ uri: "http://x", evidence: "<script>" }]
              }
            ]
          }
        ]
      }),
      context
    );
    expect(sarif.items[0]?.severity).toBe("high");
    expect(sarif.items[0]?.helpUri).toBe("https://example.test/rule");
    expect(sarif.items[0]?.description).toBe("Rule description");
    expect(sarif.items[0]?.precision).toBe("high");
    expect(sarif.items[0]?.tags).toEqual(["security"]);
    expect(sarif.items[0]?.file).toBe("a.ts");
    expect(sarif.items[0]?.line).toBe(4);
    expect(zap.items[0]?.severity).toBe("high");
    expect(zap.items[0]?.confidence).toBe("2");
    expect(zap.items[0]?.riskCode).toBe("3");
    expect(zap.items[0]?.evidence).toBe("<script>");
    expect(zap.items[0]?.cweId).toBe("79");
    expect(zap.items[0]?.wascId).toBe("8");
    expect(zap.items[0]?.remediation).toBe("Escape output");
    expect(parseSarif("{", context).warnings[0]?.code).toBe("sarif.malformed");
    expect(parseSarif("{}", context).warnings[0]?.code).toBe("sarif.no-results");
    expect(parseZapJson("{", context).warnings[0]?.code).toBe("zap.malformed");
    expect(parseZapJson("{}", context).warnings[0]?.code).toBe("zap.no-alerts");
  });
});
