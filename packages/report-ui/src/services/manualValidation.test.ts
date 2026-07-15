import { describe, expect, it } from "vitest";
import { calculateCaseStatus, validateManualExecution } from "./manualValidation";
import type { ManualExecution } from "../types";
describe("manual browser export validation", () => {
  it("calculates status and rejects inconsistent or incomplete exports", () => {
    expect(calculateCaseStatus(["passed", "failed"])).toBe("failed");
    const execution = { schemaVersion:"1.0",executionId:"run",projectKey:"APP",testedBuild:"build",environment:"test",tester:"tester",startedAt:"2026-01-01T00:00:00.000Z",completedAt:"2026-01-01T01:00:00.000Z",state:"completed",cases:[{caseId:"APP-MT-1",status:"passed",steps:[{index:0,status:"failed",evidence:[]}],defects:[],evidence:[]}] } satisfies ManualExecution;
    expect(validateManualExecution(execution)).toContain("APP-MT-1 status must be failed");
  });
  it("validates cases, step indices, and revisions against approved definitions",()=>{const execution={schemaVersion:"1.0",executionId:"run",projectKey:"APP",testedBuild:"build",environment:"test",tester:"tester",startedAt:"2026-01-01T00:00:00.000Z",completedAt:"2026-01-01T01:00:00.000Z",state:"completed",cases:[{caseId:"APP-MT-1",caseRevision:"old",status:"passed",steps:[{index:1,status:"passed",evidence:[]}],defects:[],evidence:[]}]} satisfies ManualExecution;const definitions=[{id:"APP-MT-1",title:"Case",status:"approved",priority:"medium",risk:"medium",requirements:[],tags:[],preconditions:[],steps:[{action:"Act",expected:"Observe"}],revision:"new"}];expect(validateManualExecution(execution,definitions)).toEqual(expect.arrayContaining(["APP-MT-1 steps do not match its definition","APP-MT-1 revision does not match its definition"]));});
});
