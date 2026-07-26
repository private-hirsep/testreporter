import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_HISTORY_OPTIONS } from "@quality-report/report-core";
import {
  resolveHistoryOptions,
  resolveHistorySourceOptions,
  resolveHistorySourceReportUrl
} from "../src/history-options.js";

const configured = {
  enabled: true,
  maxRuns: 20,
  maxAgeDays: 90,
  maxManualExecutions: 100,
  stability: { minimumSamples: 7, flakyTransitionThreshold: 3 },
  duration: { minimumSamples: 4, regressionPercent: 25, minimumIncreaseMs: 250 }
};

describe("standalone history option resolution", () => {
  it("resolves report URLs with explicit CLI precedence", () => {
    expect(resolveHistorySourceReportUrl(undefined, "https://config.test/report")).toBe(
      "https://config.test/report"
    );
    expect(
      resolveHistorySourceReportUrl(
        "https://cli.test/report",
        "https://config.test/report"
      )
    ).toBe("https://cli.test/report");
    expect(resolveHistorySourceReportUrl(undefined, undefined)).toBeUndefined();
  });

  it("resolves configured report URLs through the shared command resolver", async () => {
    await expect(
      resolveHistorySourceOptions({
        configPath: "examples/minimal/quality-report.yml"
      })
    ).resolves.toMatchObject({
      sourceReportUrl: "https://example.invalid/quality-report/"
    });
    await expect(
      resolveHistorySourceOptions({
        configPath: "examples/minimal/quality-report.yml",
        sourceReportUrl: "https://override.example/report/"
      })
    ).resolves.toMatchObject({
      sourceReportUrl: "https://override.example/report/"
    });
  });

  it.each(["not a URL", "file:///tmp/report", "javascript:alert(1)"])(
    "rejects invalid source report URL %s",
    (value) => {
      expect(() => resolveHistorySourceReportUrl(value, undefined)).toThrow(
        /source report URL/i
      );
    }
  );

  it("uses built-in defaults without configuration or CLI values", () => {
    expect(resolveHistoryOptions(undefined)).toEqual(DEFAULT_HISTORY_OPTIONS);
  });

  it("routes inspect, merge, and verify through the same source resolver", async () => {
    const cli = await readFile(
      path.resolve("packages/report-cli/src/index.ts"),
      "utf8"
    );
    expect(cli.match(/resolveHistorySourceOptions\(\{/g)).toHaveLength(3);
    expect(cli).toContain(
      "inspectPersistableHistoryReport(report, source.sourceReportUrl)"
    );
  });

  it("uses project configuration when CLI values are omitted", () => {
    expect(resolveHistoryOptions(configured)).toEqual({
      maxRuns: 20,
      maxAgeDays: 90,
      maxManualExecutions: 100,
      minimumSamples: 7,
      flakyTransitionThreshold: 3,
      durationMinimumSamples: 4,
      durationRegressionPercent: 25,
      durationMinimumIncreaseMs: 250
    });
  });

  it("applies partial CLI overrides over configuration", () => {
    expect(
      resolveHistoryOptions(configured, {
        maxRuns: "40",
        durationMinimumIncreaseMs: "0"
      })
    ).toMatchObject({
      maxRuns: 40,
      maxAgeDays: 90,
      maxManualExecutions: 100,
      minimumSamples: 7,
      durationMinimumIncreaseMs: 0
    });
  });

  it.each([
    [{ maxRuns: "0" }, /maximum retained runs/i],
    [{ maxAgeDays: "1.5" }, /maximum history age/i],
    [{ flakyTransitionThreshold: "-1" }, /flaky transition threshold/i],
    [{ durationRegressionPercent: "Infinity" }, /duration regression percent/i],
    [{ durationMinimumIncreaseMs: "-1" }, /duration minimum increase/i]
  ])("rejects invalid CLI thresholds", (options, message) => {
    expect(() => resolveHistoryOptions(configured, options)).toThrow(message);
  });
});
