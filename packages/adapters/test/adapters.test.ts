import { describe, expect, it } from "vitest";
import {
  parseIstanbulSummary,
  parseJaCoCoXml,
  parseJUnitXml,
  parseLcov,
  parsePlaywrightJson,
  parseSarif,
  parseZapJson
} from "../src/index.js";

const context = {
  sourcePath: "sample",
  layer: "backend" as const,
  requirementPattern: /[A-Z]+-[0-9]+/g
};

describe("adapters", () => {
  it("parses JUnit XML into normalized tests", () => {
    const result = parseJUnitXml(
      '<testsuite><testcase classname="A" name="does thing RFL-1" time="0.1"><failure message="bad">trace</failure></testcase></testsuite>',
      context
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("failed");
    expect(result.items[0]?.requirements).toEqual(["RFL-1"]);
  });

  it("parses Playwright JSON", () => {
    const result = parsePlaywrightJson(
      JSON.stringify({ suites: [{ title: "s", tests: [{ title: "t RFL-2", results: [{ status: "passed" }] }] }] }),
      { ...context, layer: "e2e" }
    );
    expect(result.items[0]?.framework).toBe("playwright");
    expect(result.items[0]?.status).toBe("passed");
  });

  it("parses coverage formats", () => {
    expect(parseJaCoCoXml('<report><counter type="LINE" missed="1" covered="3"/></report>', context).items[0]?.lines?.percentage).toBe(75);
    expect(parseLcov("SF:a.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record", context).items[0]?.lines?.percentage).toBe(100);
    expect(
      parseIstanbulSummary(JSON.stringify({ total: { lines: { total: 2, covered: 1, pct: 50 } } }), context)
        .items[0]?.lines?.percentage
    ).toBe(50);
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
                    properties: { "security-severity": "8.0", precision: "high", tags: ["security"] }
                  }
                ]
              }
            },
            results: [{ ruleId: "r", message: { text: "msg" } }]
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
    expect(zap.items[0]?.severity).toBe("high");
    expect(zap.items[0]?.confidence).toBe("2");
    expect(zap.items[0]?.riskCode).toBe("3");
    expect(zap.items[0]?.evidence).toBe("<script>");
    expect(zap.items[0]?.cweId).toBe("79");
    expect(zap.items[0]?.wascId).toBe("8");
  });
});
