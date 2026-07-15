import type { ManualExecution } from "../types";
const prefix = "quality-report:manual-draft:";
export type ManualDraftScope = { project: string; reportRun: string; testedBuild: string };
export function draftKey(scope: ManualDraftScope) {
  return prefix + [scope.project, scope.reportRun, scope.testedBuild].map(encodeURIComponent).join(":");
}
export const manualDrafts = {
  save(scope: ManualDraftScope, value: ManualExecution) { localStorage.setItem(draftKey(scope), JSON.stringify(value)); },
  load(scope: ManualDraftScope) { const value = localStorage.getItem(draftKey(scope)); return value ? JSON.parse(value) as ManualExecution : undefined; },
  remove(scope: ManualDraftScope) { localStorage.removeItem(draftKey(scope)); }
};
