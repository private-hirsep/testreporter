import { describe, expect, it } from "vitest";
import { filterExecutions, sortExecutions } from "./executionView";
import type { UnifiedExecution } from "../types";

function execution(
  id: string,
  extra: Partial<UnifiedExecution> = {}
): UnifiedExecution {
  return {
    id,
    type: "automated",
    project: "Demo",
    status: "passed",
    counts: { total: 1, passed: 1, failed: 0 },
    testCaseIds: ["CASE-1"],
    caseResults: [{ testCaseId: "CASE-1", status: "passed" }],
    requirementIds: [],
    defectIds: [],
    ...extra
  };
}

describe("execution view model", () => {
  const entries = [
    execution("automated", {
      branch: "main",
      environment: "ci",
      release: "2",
      reportedAt: "2026-07-23T12:00:00.000Z"
    }),
    execution("manual", {
      type: "manual",
      status: "failed",
      branch: "release",
      environment: "staging",
      release: "2",
      completedAt: "2026-07-22T12:00:00.000Z",
      caseResults: [{ testCaseId: "CASE-1", status: "failed" }],
      evidence: { complete: false, referenceCount: 0 }
    })
  ];

  it("combines type, status, branch, environment, failure, and evidence filters", () => {
    expect(
      filterExecutions(entries, {
        search: "",
        type: "manual",
        status: "failed",
        release: "2",
        branch: "release",
        environment: "staging",
        failure: "contains failures",
        evidence: "incomplete"
      }).map((item) => item.id)
    ).toEqual(["manual"]);
  });

  it("handles missing metadata and reported time sorting", () => {
    expect(sortExecutions(entries, "newest").map((item) => item.id)).toEqual([
      "automated",
      "manual"
    ]);
    expect(
      filterExecutions([execution("missing")], {
        search: "",
        type: "all",
        status: "all",
        release: "all",
        branch: "all",
        environment: "all",
        failure: "no failures",
        evidence: "incomplete"
      })
    ).toHaveLength(1);
  });
});
