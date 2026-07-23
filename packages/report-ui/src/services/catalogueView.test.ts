import { describe, expect, it } from "vitest";
import {
  catalogueCounts,
  catalogueOptions,
  catalogueSearchIndex,
  filterCatalogue,
  sortCatalogue,
  type CatalogueFilters
} from "./catalogueView";
import type { CatalogueStatus, TestCaseCatalogueEntry } from "../types";

function entry(
  id: string,
  status: CatalogueStatus,
  extra: Partial<TestCaseCatalogueEntry> = {}
): TestCaseCatalogueEntry {
  return {
    id,
    canonicalId: id,
    displayId: id,
    identity: { source: "explicit", stable: true, conflict: false },
    title: `Case ${id}`,
    type: "automated",
    requirements: [],
    defects: [],
    tags: [],
    implementations: [
      {
        technicalId: `technical-${id}`,
        kind: "automated",
        title: `Case ${id}`,
        framework: "playwright",
        layer: "e2e",
        requirements: [],
        defects: [],
        tags: [],
        active: true,
        latestResult: { status }
      }
    ],
    latestResult: { status, contributingStatuses: [status] },
    stability: {
      available: false,
      sampleSize: 1,
      passed: status === "passed" ? 1 : 0,
      failed: status === "failed" || status === "broken" ? 1 : 0,
      flaky: 0,
      source: "insufficient-data"
    },
    ...extra
  };
}

const defaults: CatalogueFilters = {
  search: "",
  quick: "all",
  status: "all",
  type: "all",
  identity: "all",
  framework: "all",
  layer: "all",
  requirement: "all",
  defect: "all",
  tag: "all",
  lifecycle: "all",
  execution: "all",
  stability: "all"
};

describe("catalogue view model", () => {
  const entries = [
    entry("CASE-2", "failed", {
      requirements: ["REQ-1"],
      defects: ["BUG-2"],
      tags: ["checkout"],
      duration: { sampleSize: 1, latestMs: 20, source: "automated" }
    }),
    entry("CASE-1", "passed", {
      requirements: ["REQ-1"],
      tags: ["smoke"],
      duration: { sampleSize: 1, latestMs: 10, source: "automated" }
    }),
    entry("CASE-3", "broken", {
      type: "manual",
      requirements: ["REQ-2"],
      lifecycleStatus: "approved"
    })
  ];

  it("counts logical catalogue entries rather than implementations", () => {
    entries[0]!.implementations.push({ ...entries[0]!.implementations[0]!, technicalId: "variant" });
    expect(catalogueCounts(entries)).toMatchObject({
      all: 3,
      passed: 1,
      failed: 1,
      broken: 1,
      slowest: 2
    });
  });

  it("combines requirement, defect, tag, framework, layer, and type filters", () => {
    const filtered = filterCatalogue(
      entries,
      {
        ...defaults,
        requirement: "REQ-1",
        defect: "BUG-2",
        tag: "checkout",
        framework: "playwright",
        layer: "e2e",
        type: "automated"
      },
      catalogueSearchIndex(entries)
    );
    expect(filtered.map((item) => item.canonicalId)).toEqual(["CASE-2"]);
    expect(catalogueOptions(entries).requirements).toEqual(["all", "REQ-1", "REQ-2"]);
  });

  it("sorts status and duration in both directions with missing values last", () => {
    expect(sortCatalogue(entries, "status", "ascending").map((item) => item.canonicalId)).toEqual([
      "CASE-3",
      "CASE-2",
      "CASE-1"
    ]);
    expect(sortCatalogue(entries, "status", "descending").map((item) => item.canonicalId)).toEqual([
      "CASE-1",
      "CASE-2",
      "CASE-3"
    ]);
    expect(sortCatalogue(entries, "duration", "ascending").map((item) => item.canonicalId)).toEqual([
      "CASE-1",
      "CASE-2",
      "CASE-3"
    ]);
    expect(sortCatalogue(entries, "duration", "descending").map((item) => item.canonicalId)).toEqual([
      "CASE-2",
      "CASE-1",
      "CASE-3"
    ]);
  });

  it("handles a large filtered fixture without expanding its entries", () => {
    const large = Array.from({ length: 5000 }, (_, index) =>
      entry(`LARGE-${index}`, index % 2 ? "passed" : "failed")
    );
    expect(filterCatalogue(large, { ...defaults, status: "failed" })).toHaveLength(2500);
  });
});
