import { describe, expect, it } from "vitest";
import {
  deriveTestCaseCatalogue,
  deriveUnifiedExecutions,
  ManualCaseSchema,
  ManualExecutionSchema,
  NormalizedTestCaseSchema,
  type NormalizedTestCase
} from "../src/index.js";

const metadata = {
  projectName: "Catalogue demo",
  projectKey: "DEMO",
  generatedAt: "2026-07-23T12:00:00.000Z",
  branch: "main",
  commitSha: "abc123",
  release: "2.0"
};

function automated(
  canonicalId: string,
  technicalId: string,
  status: "passed" | "failed" | "broken" | "skipped" | "unknown",
  extra: Partial<NormalizedTestCase> = {}
) {
  return NormalizedTestCaseSchema.parse({
    id: technicalId,
    name: extra.name ?? `${canonicalId} verifies behaviour`,
    framework: extra.framework ?? "playwright",
    layer: extra.layer ?? "e2e",
    status,
    durationMs: extra.durationMs,
    retries: extra.retries ?? 0,
    requirements: extra.requirements ?? [],
    defects: extra.defects ?? [],
    tags: extra.tags ?? [],
    links: [],
    labels: extra.labels ?? {},
    attachments: [],
    identity: {
      canonicalId,
      technicalId,
      source: extra.identity?.source ?? "explicit",
      stable: extra.identity?.stable ?? true
    },
    ...extra
  });
}

function manualCase(id: string, status: "draft" | "approved" | "deprecated" = "approved") {
  return ManualCaseSchema.parse({
    id,
    title: `${id} manual verification`,
    status,
    requirements: ["REQ-M"],
    tags: ["manual"],
    steps: [{ action: "Act", expected: "Observe" }]
  });
}

function manualExecution(
  executionId: string,
  caseId: string,
  status: "passed" | "failed" | "blocked" | "skipped",
  completedAt: string,
  state: "draft" | "completed" = "completed"
) {
  return ManualExecutionSchema.parse({
    schemaVersion: "1.0",
    executionId,
    projectKey: "DEMO",
    release: "2.0",
    testedBuild: "abc123",
    environment: "staging",
    tester: "Tester",
    startedAt: "2026-07-23T10:00:00.000Z",
    ...(state === "completed" ? { completedAt } : {}),
    state,
    cases: [
      {
        caseId,
        status,
        steps: [{ index: 0, status, evidence: ["proof.png"] }],
        defects: status === "failed" ? ["BUG-1"] : [],
        evidence: []
      }
    ]
  });
}

describe("logical test case catalogue", () => {
  it("derives automated, manual and explicitly associated hybrid entries", () => {
    const catalogue = deriveTestCaseCatalogue({
      tests: [automated("AUTO-1", "chromium", "passed"), automated("HYBRID-1", "api", "passed")],
      manualCases: [manualCase("MANUAL-1"), manualCase("HYBRID-1")],
      manualExecutions: [manualExecution("manual-1", "MANUAL-1", "passed", "2026-07-23T11:00:00.000Z")],
      metadata
    });
    expect(catalogue.map((item) => [item.canonicalId, item.type])).toEqual([
      ["AUTO-1", "automated"],
      ["HYBRID-1", "hybrid"],
      ["MANUAL-1", "manual"]
    ]);
  });

  it("preserves browser variants and prevents a pass from hiding a failure", () => {
    const entry = deriveTestCaseCatalogue({
      tests: [
        automated("CHECKOUT-1", "chromium", "passed", { labels: { browser: ["chromium"] } }),
        automated("CHECKOUT-1", "firefox", "failed", { labels: { browser: ["firefox"] } })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(entry.implementations.map((item) => item.technicalId)).toEqual(["chromium", "firefox"]);
    expect(entry.latestResult?.status).toBe("failed");
    expect(entry.latestResult?.contributingStatuses).toEqual(["failed", "passed"]);
  });

  it("marks generated identities unstable and explicit duplicate conflicts without losing implementations", () => {
    const generated = automated("generated-1", "generated-tech", "passed", {
      identity: { canonicalId: "generated-1", technicalId: "generated-tech", source: "generated", stable: false }
    });
    const catalogue = deriveTestCaseCatalogue({
      tests: [generated, automated("DUP-1", "one", "passed"), automated("DUP-1", "two", "failed")],
      manualCases: [],
      manualExecutions: [],
      metadata,
      identityDiagnostics: {
        total: 3, explicit: 2, titleToken: 0, mapping: 0, generated: 1,
        duplicateCanonicalIds: ["DUP-1"], duplicateExplicitIds: ["DUP-1"],
        malformedExplicitIds: 0, ambiguousMappings: 0
      }
    });
    expect(catalogue.find((item) => item.canonicalId === "generated-1")?.identity.stable).toBe(false);
    expect(catalogue.find((item) => item.canonicalId === "DUP-1")).toMatchObject({
      identity: { conflict: true, stable: false },
      implementations: [{ technicalId: "one" }, { technicalId: "two" }]
    });
  });

  it("excludes draft and deprecated manual definitions from active results", () => {
    const catalogue = deriveTestCaseCatalogue({
      tests: [],
      manualCases: [manualCase("DRAFT-1", "draft"), manualCase("OLD-1", "deprecated")],
      manualExecutions: [
        manualExecution("draft-result", "DRAFT-1", "failed", "2026-07-23T11:00:00.000Z"),
        manualExecution("old-result", "OLD-1", "failed", "2026-07-23T11:00:00.000Z")
      ],
      metadata
    });
    expect(catalogue.every((item) => item.latestResult === undefined)).toBe(true);
    expect(catalogue.every((item) => item.implementations[0]?.active === false)).toBe(true);
  });

  it("uses deterministic title precedence and merges traceability metadata", () => {
    const entry = deriveTestCaseCatalogue({
      tests: [
        automated("SHARED-1", "b", "passed", { name: "Zulu", requirements: ["REQ-B"], defects: ["BUG-2"], tags: ["e2e"] }),
        automated("SHARED-1", "a", "passed", { name: "Alpha", requirements: ["REQ-A"], defects: ["BUG-1"], tags: ["smoke"] })
      ],
      manualCases: [ManualCaseSchema.parse({ ...manualCase("SHARED-1"), title: "Approved authority" })],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(entry.title).toBe("Approved authority");
    expect(entry.requirements).toEqual(["REQ-A", "REQ-B", "REQ-M"]);
    expect(entry.defects).toEqual(["BUG-1", "BUG-2"]);
    expect(entry.tags).toEqual(["e2e", "manual", "smoke"]);
  });

  it("reports honest stability and deterministic duration statistics", () => {
    const one = deriveTestCaseCatalogue({
      tests: [automated("ONE-1", "one", "passed", { durationMs: 10 })],
      manualCases: [], manualExecutions: [], metadata
    })[0]!;
    expect(one.stability).toMatchObject({ available: false, sampleSize: 1, source: "insufficient-data" });
    const several = deriveTestCaseCatalogue({
      tests: [],
      manualCases: [manualCase("MANY-1")],
      manualExecutions: [
        manualExecution("one", "MANY-1", "passed", "2026-07-21T10:00:00.000Z"),
        manualExecution("two", "MANY-1", "failed", "2026-07-22T10:00:00.000Z"),
        manualExecution("three", "MANY-1", "passed", "2026-07-23T10:00:00.000Z")
      ],
      metadata
    })[0]!;
    expect(several.stability).toMatchObject({ available: true, sampleSize: 3, passed: 2, failed: 1, flaky: 0, passRate: 66.67 });
    const durations = deriveTestCaseCatalogue({
      tests: [
        automated("DURATION-1", "a", "passed", { durationMs: 10 }),
        automated("DURATION-1", "b", "failed", { durationMs: 30 }),
        automated("DURATION-1", "c", "passed", { durationMs: 20, retries: 1 })
      ],
      manualCases: [], manualExecutions: [], metadata
    })[0]!;
    expect(durations.stability.available).toBe(false);
    expect(durations.duration).toMatchObject({ sampleSize: 3, averageMs: 20, medianMs: 20, minMs: 10, maxMs: 30 });
  });

  it("derives several thousand entries in a linear grouping pass", () => {
    const tests = Array.from({ length: 5000 }, (_, index) =>
      automated(`PERF-${index}`, `technical-${index}`, "passed")
    );
    const start = performance.now();
    const catalogue = deriveTestCaseCatalogue({ tests, manualCases: [], manualExecutions: [], metadata });
    expect(catalogue).toHaveLength(5000);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe("unified executions", () => {
  it("creates one automated run plus sorted completed validated manual runs", () => {
    const input = {
      tests: [automated("AUTO-1", "one", "passed", { requirements: ["REQ-A"], defects: ["BUG-A"] })],
      manualCases: [manualCase("MANUAL-1")],
      manualExecutions: [
        manualExecution("manual-new", "MANUAL-1", "failed", "2026-07-23T11:30:00.000Z"),
        manualExecution("manual-old", "MANUAL-1", "passed", "2026-07-23T11:00:00.000Z"),
        manualExecution("manual-draft", "MANUAL-1", "passed", "2026-07-23T11:45:00.000Z", "draft")
      ],
      metadata: { ...metadata, runId: "run-42" }
    };
    const executions = deriveUnifiedExecutions(input);
    expect(executions.map((item) => item.id)).toEqual(["run-42", "manual-new", "manual-old"]);
    expect(executions[0]).toMatchObject({
      type: "automated", testCaseIds: ["AUTO-1"], requirementIds: ["REQ-A"], defectIds: ["BUG-A"]
    });
    expect(executions[1]).toMatchObject({
      type: "manual", status: "failed", testCaseIds: ["MANUAL-1"], requirementIds: ["REQ-M"], defectIds: ["BUG-1"]
    });
  });

  it("generates a deterministic automated ID when run metadata has no run ID", () => {
    const input = { tests: [automated("AUTO-1", "one", "passed")], manualCases: [], manualExecutions: [], metadata };
    expect(deriveUnifiedExecutions(input)[0]?.id).toBe(deriveUnifiedExecutions(input)[0]?.id);
    expect(deriveUnifiedExecutions(input)[0]?.id).toMatch(/^automated-/);
  });

  it("handles missing automated metadata and no executions safely", () => {
    expect(deriveUnifiedExecutions({ tests: [], manualCases: [], manualExecutions: [], metadata })).toEqual([]);
  });
});
