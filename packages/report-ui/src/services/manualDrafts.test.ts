import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftKey, manualDrafts, type ManualDraftScope } from "./manualDrafts";
import type { ManualExecution } from "../types";
const values = new Map<string, string>();
beforeEach(() => { values.clear(); vi.stubGlobal("localStorage", { setItem:(key:string,value:string)=>values.set(key,value), getItem:(key:string)=>values.get(key)??null, removeItem:(key:string)=>values.delete(key) }); });
const scope:ManualDraftScope={project:"APP",reportRun:"report-1",testedBuild:"baseline-build"};
function execution(executionId:string,testedBuild:string):ManualExecution { return {schemaVersion:"1.0",executionId,projectKey:"APP",testedBuild,environment:"test",tester:"tester",startedAt:"2026-01-01T00:00:00.000Z",state:"draft",cases:[]}; }
describe("manual draft persistence",()=>{
  it("keeps storage identity stable when editable audit metadata changes",()=>{const draft=execution("run-1","edited-build");manualDrafts.save(scope,draft);draft.executionId="renamed";draft.testedBuild="another-build";manualDrafts.save(scope,draft);expect(manualDrafts.load(scope)).toEqual(draft);expect(values.size).toBe(1);expect(draftKey(scope)).toContain("baseline-build");});
  it("does not restore a different report context",()=>{manualDrafts.save(scope,execution("run-1","build"));expect(manualDrafts.load({...scope,reportRun:"report-2"})).toBeUndefined();});
});
