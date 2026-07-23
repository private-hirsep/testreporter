import type { TestCaseCatalogueEntry } from "../types";

export type CatalogueSort =
  | "attention"
  | "id"
  | "title"
  | "status"
  | "executed"
  | "duration"
  | "stability"
  | "implementations";
export type SortDirection = "ascending" | "descending";

export type CatalogueFilters = {
  search: string;
  quick: string;
  status: string;
  type: string;
  identity: string;
  framework: string;
  layer: string;
  requirement: string;
  defect: string;
  tag: string;
  lifecycle: string;
  execution: string;
  stability: string;
};

const statusRank: Record<string, number> = {
  broken: 0,
  failed: 1,
  blocked: 2,
  "not-run": 3,
  skipped: 4,
  unknown: 5,
  passed: 6
};

export function catalogueSearchIndex(entries: TestCaseCatalogueEntry[]) {
  return new Map(
    entries.map((item) => [
      item.id,
      [
        item.canonicalId,
        item.title,
        ...item.requirements,
        ...item.defects,
        ...item.tags,
        ...item.implementations.flatMap((implementation) => [
          implementation.framework,
          implementation.layer,
          implementation.source?.file
        ])
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
    ])
  );
}

export function catalogueCounts(entries: TestCaseCatalogueEntry[]) {
  const status = (value: string) =>
    entries.filter((item) => (item.latestResult?.status ?? "not-run") === value).length;
  return {
    all: entries.length,
    passed: status("passed"),
    failed: status("failed"),
    broken: status("broken"),
    blocked: status("blocked"),
    skipped: status("skipped"),
    notRun: status("not-run"),
    generated: entries.filter((item) => item.identity.source === "generated").length,
    conflicted: entries.filter((item) => item.identity.conflict).length,
    flaky: entries.filter((item) => item.stability.flaky > 0).length,
    slowest: Math.min(10, entries.filter((item) => item.duration?.latestMs !== undefined).length)
  };
}

export function filterCatalogue(
  entries: TestCaseCatalogueEntry[],
  filters: CatalogueFilters,
  searchIndex = catalogueSearchIndex(entries)
) {
  const query = filters.search.trim().toLocaleLowerCase();
  return entries.filter((item) => {
    const currentStatus = item.latestResult?.status ?? "not-run";
    return (
      (filters.quick === "all" ||
        (filters.quick === "flaky"
          ? item.stability.flaky > 0
          : filters.quick === "slowest" ||
            currentStatus === filters.quick)) &&
      (!query || searchIndex.get(item.id)?.includes(query)) &&
      (filters.status === "all" || currentStatus === filters.status) &&
      (filters.type === "all" || item.type === filters.type) &&
      (filters.identity === "all" ||
        (filters.identity === "conflicted"
          ? item.identity.conflict
          : filters.identity === "stable"
            ? item.identity.stable && !item.identity.conflict
            : item.identity.source === "generated" && !item.identity.conflict)) &&
      (filters.framework === "all" ||
        item.implementations.some(
          (implementation) => implementation.framework === filters.framework
        )) &&
      (filters.layer === "all" ||
        item.implementations.some((implementation) => implementation.layer === filters.layer)) &&
      (filters.requirement === "all" || item.requirements.includes(filters.requirement)) &&
      (filters.defect === "all" || item.defects.includes(filters.defect)) &&
      (filters.tag === "all" || item.tags.includes(filters.tag)) &&
      (filters.lifecycle === "all" || item.lifecycleStatus === filters.lifecycle) &&
      (filters.execution === "all" ||
        (filters.execution === "executed") === Boolean(item.lastExecutedAt)) &&
      (filters.stability === "all" ||
        (filters.stability === "available"
          ? item.stability.available
          : filters.stability === "unavailable"
            ? !item.stability.available
            : item.stability.flaky > 0))
    );
  });
}

function optionalNumber(
  left: number | undefined,
  right: number | undefined,
  direction: SortDirection
) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return direction === "ascending" ? left - right : right - left;
}

export function sortCatalogue(
  entries: TestCaseCatalogueEntry[],
  sort: CatalogueSort,
  direction: SortDirection
) {
  const multiplier = direction === "ascending" ? 1 : -1;
  return [...entries].sort((left, right) => {
    const tie = left.canonicalId.localeCompare(right.canonicalId);
    let result = 0;
    switch (sort) {
      case "id":
        result = tie;
        break;
      case "title":
        result = left.title.localeCompare(right.title) || tie;
        break;
      case "status":
        result =
          (statusRank[left.latestResult?.status ?? "not-run"] ?? 9) -
            (statusRank[right.latestResult?.status ?? "not-run"] ?? 9) || tie;
        break;
      case "executed":
        result = optionalNumber(
          left.lastExecutedAt ? Date.parse(left.lastExecutedAt) : undefined,
          right.lastExecutedAt ? Date.parse(right.lastExecutedAt) : undefined,
          direction
        );
        return result || tie;
      case "duration":
        result = optionalNumber(left.duration?.latestMs, right.duration?.latestMs, direction);
        return result || tie;
      case "stability":
        result = optionalNumber(left.stability.passRate, right.stability.passRate, direction);
        return result || tie;
      case "implementations":
        result = left.implementations.length - right.implementations.length || tie;
        break;
      default:
        result =
          (left.identity.conflict === right.identity.conflict
            ? 0
            : left.identity.conflict
              ? -1
              : 1) ||
          (statusRank[left.latestResult?.status ?? "not-run"] ?? 9) -
            (statusRank[right.latestResult?.status ?? "not-run"] ?? 9) ||
          tie;
    }
    return multiplier * result;
  });
}

export function catalogueOptions(entries: TestCaseCatalogueEntry[]) {
  const values = (items: Array<string | undefined>) => [
    "all",
    ...new Set(items.filter((item): item is string => Boolean(item)).sort())
  ];
  return {
    frameworks: values(
      entries.flatMap((item) =>
        item.implementations.map((implementation) => implementation.framework)
      )
    ),
    layers: values(
      entries.flatMap((item) =>
        item.implementations.map((implementation) => implementation.layer)
      )
    ),
    requirements: values(entries.flatMap((item) => item.requirements)),
    defects: values(entries.flatMap((item) => item.defects)),
    tags: values(entries.flatMap((item) => item.tags))
  };
}
