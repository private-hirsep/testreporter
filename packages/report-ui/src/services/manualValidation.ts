import type { ManualCase, ManualExecution, ManualStatus } from "../types";
export function calculateCaseStatus(statuses: ManualStatus[]): ManualStatus {
  if (!statuses.length || statuses.every((status) => status === "not-run")) return "not-run";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.every((status) => status === "skipped")) return "skipped";
  if (statuses.every((status) => status === "passed" || status === "skipped")) return "passed";
  return "not-run";
}
export function validateManualExecution(value: ManualExecution, definitions: ManualCase[] = []): string[] {
  const errors: string[] = [];
  for (const field of ["executionId", "projectKey", "testedBuild", "environment", "tester"] as const) if (!value[field]?.trim()) errors.push(`${field} is required`);
  if (Number.isNaN(Date.parse(value.startedAt))) errors.push("startedAt must be a valid timestamp");
  if (value.state !== "completed") errors.push("execution must be completed");
  if (!value.completedAt || Number.isNaN(Date.parse(value.completedAt))) errors.push("completedAt must be a valid timestamp");
  const ids = new Set<string>();
  value.cases.forEach((result) => {
    if (ids.has(result.caseId)) errors.push(`duplicate case ID: ${result.caseId}`); ids.add(result.caseId);
    if (result.steps.some((step) => step.status === "not-run")) errors.push(`${result.caseId} has not-run steps`);
    const calculated = calculateCaseStatus(result.steps.map((step) => step.status));
    if (result.status !== calculated) errors.push(`${result.caseId} status must be ${calculated}`);
    if (definitions.length) {
      const definition = definitions.find((item) => item.id === result.caseId && item.status === "approved");
      if (!definition) errors.push(`${result.caseId} is not an approved manual case`);
      else {
        if (result.steps.length !== definition.steps.length || result.steps.some((step, index) => step.index !== index)) errors.push(`${result.caseId} steps do not match its definition`);
        if (definition.revision && result.caseRevision !== definition.revision) errors.push(`${result.caseId} revision does not match its definition`);
      }
    }
  });
  return errors;
}
