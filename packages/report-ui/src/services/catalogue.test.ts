import { describe, expect, it } from "vitest";
import { catalogueFor, executionsFor } from "./catalogue";
import { evidenceRoute, executionRoute, requirementRoute, testCaseRoute } from "./routes";
import type { Manifest, TestCase } from "../types";

const legacyTest: TestCase = {
  id: "technical/id",
  name: "Legacy case",
  framework: "junit",
  layer: "backend",
  status: "passed",
  durationMs: 12,
  retries: 0,
  requirements: ["REQ/1"]
};

describe("catalogue compatibility", () => {
  it("derives a safe minimal automated case for an older report", () => {
    expect(catalogueFor(undefined, [legacyTest])[0]).toMatchObject({
      canonicalId: "technical/id",
      title: "Legacy case",
      type: "automated",
      identity: { stable: false, conflict: false },
      stability: { available: false, sampleSize: 1 }
    });
  });

  it("uses generated catalogue and execution data without recalculation", () => {
    const catalogue = catalogueFor(undefined, [legacyTest]);
    const manifest = {
      testCaseCatalogue: catalogue,
      unifiedExecutions: [
        {
          id: "run/1",
          type: "automated",
          project: "P",
          status: "passed",
          counts: { total: 1, passed: 1, failed: 0 },
          testCaseIds: ["technical/id"],
          requirementIds: ["REQ/1"],
          defectIds: []
        }
      ]
    } as unknown as Manifest;
    expect(catalogueFor(manifest, [])).toBe(catalogue);
    expect(executionsFor(manifest)).toHaveLength(1);
  });

  it("builds route locations without embedding raw IDs in selectors", () => {
    expect(testCaseRoute("A/B #1")).toEqual({ name: "test-case", params: { id: "A/B #1" } });
    expect(executionRoute("run/1")).toEqual({ name: "execution", params: { id: "run/1" } });
    expect(requirementRoute("REQ/1")).toEqual({
      path: "/requirements",
      hash: "#requirement-REQ%2F1"
    });
    expect(evidenceRoute()).toEqual({ path: "/downloads", hash: "#evidence-artifacts" });
  });

  it("handles empty catalogue and executions", () => {
    expect(catalogueFor(undefined, [])).toEqual([]);
    expect(executionsFor(undefined)).toEqual([]);
  });
});
