import { describe, expect, it } from "vitest";
import { calculateCaseStatus, validateManualExecution } from "./manualValidation";
import type { ManualExecution } from "../types";
describe("manual browser export validation", () => {
  it("calculates status and rejects inconsistent or incomplete exports", () => {
    expect(calculateCaseStatus(["passed", "failed"])).toBe("failed");
    const execution = { schemaVersion:"1.0",executionId:"run",projectKey:"APP",testedBuild:"build",environment:"test",tester:"tester",startedAt:"2026-01-01T00:00:00.000Z",completedAt:"2026-01-01T01:00:00.000Z",state:"completed",cases:[{caseId:"APP-MT-1",status:"passed",steps:[{index:0,status:"failed",evidence:[]}],defects:[],evidence:[]}] } satisfies ManualExecution;
    expect(validateManualExecution(execution)).toContain("APP-MT-1 status must be failed");
  });
});
