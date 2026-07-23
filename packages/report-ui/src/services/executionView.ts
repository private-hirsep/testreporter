import type { UnifiedExecution } from "../types";

export type ExecutionFilters = {
  search: string;
  type: string;
  status: string;
  release: string;
  branch: string;
  environment: string;
  failure: string;
  evidence: string;
};

export function executionFailureCount(item: UnifiedExecution) {
  return item.caseResults.filter((result) =>
    ["failed", "broken", "blocked"].includes(result.status)
  ).length;
}

export function executionTime(item: UnifiedExecution) {
  return Date.parse(item.completedAt ?? item.startedAt ?? item.reportedAt ?? "0") || 0;
}

export function filterExecutions(entries: UnifiedExecution[], filters: ExecutionFilters) {
  const query = filters.search.toLocaleLowerCase();
  return entries.filter(
    (item) =>
      `${item.id} ${item.release ?? ""} ${item.branch ?? ""} ${item.environment ?? ""} ${item.commit ?? ""}`
        .toLocaleLowerCase()
        .includes(query) &&
      (filters.type === "all" || item.type === filters.type) &&
      (filters.status === "all" || item.status === filters.status) &&
      (filters.release === "all" || item.release === filters.release) &&
      (filters.branch === "all" || item.branch === filters.branch) &&
      (filters.environment === "all" || item.environment === filters.environment) &&
      (filters.failure === "all" ||
        (filters.failure === "contains failures") === (executionFailureCount(item) > 0)) &&
      (filters.evidence === "all" ||
        (filters.evidence === "complete") === Boolean(item.evidence?.complete))
  );
}

export function sortExecutions(entries: UnifiedExecution[], sort: string) {
  const severity: Record<string, number> = {
    failed: 0,
    blocked: 1,
    incomplete: 2,
    unknown: 3,
    passed: 4
  };
  return [...entries].sort((left, right) => {
    if (sort === "oldest")
      return executionTime(left) - executionTime(right) || left.id.localeCompare(right.id);
    if (sort === "status")
      return (severity[left.status] ?? 9) - (severity[right.status] ?? 9) ||
        left.id.localeCompare(right.id);
    if (sort === "duration")
      return (right.durationMs ?? -1) - (left.durationMs ?? -1) ||
        left.id.localeCompare(right.id);
    if (sort === "failed")
      return executionFailureCount(right) - executionFailureCount(left) ||
        left.id.localeCompare(right.id);
    return executionTime(right) - executionTime(left) || left.id.localeCompare(right.id);
  });
}
