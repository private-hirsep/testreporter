import type { ManualExecution } from "../types";
const prefix = "quality-report:manual-draft:";
export function draftKey(
  value: Pick<ManualExecution, "projectKey" | "release" | "executionId" | "testedBuild">
) {
  return (
    prefix +
    [value.projectKey, value.release ?? "", value.executionId, value.testedBuild]
      .map(encodeURIComponent)
      .join(":")
  );
}
export const manualDrafts = {
  save(value: ManualExecution) {
    localStorage.setItem(draftKey(value), JSON.stringify(value));
  },
  load(key: string) {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as ManualExecution) : undefined;
  },
  remove(key: string) {
    localStorage.removeItem(key);
  },
  list() {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => ({ key, value: this.load(key)! }))
      .filter((item) => item.value);
  },
  find(context: Pick<ManualExecution, "projectKey" | "release" | "executionId" | "testedBuild">) {
    return this.load(draftKey(context));
  }
};
