import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftKey, manualDrafts } from "./manualDrafts";
import type { ManualExecution } from "../types";
const values = new Map<string, string>();
beforeEach(() => { values.clear(); vi.stubGlobal("localStorage", { setItem:(key:string,value:string)=>values.set(key,value), getItem:(key:string)=>values.get(key)??null, removeItem:(key:string)=>values.delete(key), key:(index:number)=>[...values.keys()][index]??null, get length(){return values.size} }); });
function execution(executionId:string,testedBuild:string):ManualExecution { return {schemaVersion:"1.0",executionId,projectKey:"APP",testedBuild,environment:"test",tester:"tester",startedAt:"2026-01-01T00:00:00.000Z",state:"draft",cases:[]}; }
describe("manual draft persistence",()=>{
  it("restores only the exact project/release/execution/build context",()=>{const first=execution("run-1","build-1");const second=execution("run-2","build-2");manualDrafts.save(first);manualDrafts.save(second);expect(manualDrafts.find(first)).toEqual(first);expect(manualDrafts.find({...first,testedBuild:"other"})).toBeUndefined();expect(draftKey(first)).not.toBe(draftKey(second));});
});
