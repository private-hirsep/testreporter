import { describe, expect, it } from "vitest";

import { DEFAULT_HISTORY_OPTIONS } from "@quality-report/report-core";
import { resolveHistoryOptions } from "../src/history-options.js";

const configured = {
  enabled: true,
  maxRuns: 20,
  maxAgeDays: 90,
  maxManualExecutions: 100,
  stability: { minimumSamples: 7, flakyTransitionThreshold: 3 },
  duration: { minimumSamples: 4, regressionPercent: 25, minimumIncreaseMs: 250 }
};

describe("standalone history option resolution", () => {
  it("uses built-in defaults without configuration or CLI values", () => {
    expect(resolveHistoryOptions(undefined)).toEqual(DEFAULT_HISTORY_OPTIONS);
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
