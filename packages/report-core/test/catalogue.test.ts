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
      tests: [
        generated,
        automated("DUP-1", "one", "passed", { name: "creates account" }),
        automated("DUP-1", "two", "failed", { name: "deletes invoice" })
      ],
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

  it("does not mark compatible browser variants as identity conflicts", () => {
    const entry = deriveTestCaseCatalogue({
      tests: [
        automated("VARIANT-1", "chromium", "passed", {
          name: "[VARIANT-1] completes checkout",
          variant: { project: "desktop", browser: "chromium" }
        }),
        automated("VARIANT-1", "firefox", "failed", {
          name: "[VARIANT-1] completes checkout",
          variant: { project: "desktop", browser: "firefox" }
        })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(entry.identity.conflict).toBe(false);
    expect(entry.implementations.map((item) => item.variant?.browser)).toEqual([
      "chromium",
      "firefox"
    ]);
    expect(entry.stability.unavailableReason).toBeUndefined();
  });

  it("keeps a compatible manual association hybrid and marks incompatible hybrids untrusted", () => {
    const compatible = deriveTestCaseCatalogue({
      tests: [
        automated("HYBRID-COMPATIBLE", "chromium", "passed", {
          name: "[HYBRID-COMPATIBLE] completes checkout",
          variant: { browser: "chromium" }
        }),
        automated("HYBRID-COMPATIBLE", "firefox", "passed", {
          name: "[HYBRID-COMPATIBLE] completes checkout",
          variant: { browser: "firefox" }
        })
      ],
      manualCases: [
        ManualCaseSchema.parse({
          ...manualCase("HYBRID-COMPATIBLE"),
          title: "Completes checkout"
        })
      ],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(compatible).toMatchObject({
      type: "hybrid",
      identity: { conflict: false },
      stability: { available: false, sampleSize: 1 }
    });

    const input = {
      tests: [
        automated("HYBRID-CONFLICT", "chromium", "passed", {
          name: "[HYBRID-CONFLICT] completes checkout",
          variant: { browser: "chromium" }
        }),
        automated("HYBRID-CONFLICT", "firefox", "passed", {
          name: "[HYBRID-CONFLICT] completes checkout",
          variant: { browser: "firefox" }
        })
      ],
      manualCases: [
        ManualCaseSchema.parse({
          ...manualCase("HYBRID-CONFLICT"),
          title: "Deletes customer"
        })
      ],
      manualExecutions: [
        manualExecution("old", "HYBRID-CONFLICT", "passed", "2026-07-22T10:00:00.000Z"),
        manualExecution("new", "HYBRID-CONFLICT", "failed", "2026-07-23T10:00:00.000Z")
      ],
      metadata
    };
    const conflicted = deriveTestCaseCatalogue(input)[0]!;
    expect(conflicted).toMatchObject({
      identity: { conflict: true },
      stability: {
        available: false,
        sampleSize: 3,
        unavailableReason: "identity-conflict"
      }
    });
    expect(conflicted.stability.passRate).toBeUndefined();
    expect(
      deriveTestCaseCatalogue({
        ...input,
        tests: [...input.tests].reverse(),
        manualExecutions: [...input.manualExecutions].reverse()
      })[0]!.stability
    ).toEqual(conflicted.stability);
  });

  it("calculates aggregate status independently from the newest execution timestamp", () => {
    const olderFailure = deriveTestCaseCatalogue({
      tests: [
        automated("TIME-1", "firefox", "failed", {
          executedAt: "2026-07-10T10:00:00.000Z",
          variant: { browser: "firefox" }
        }),
        automated("TIME-1", "chromium", "passed", {
          executedAt: "2026-07-23T10:00:00.000Z",
          variant: { browser: "chromium" }
        })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(olderFailure.latestResult?.status).toBe("failed");
    expect(olderFailure.lastExecutedAt).toBe("2026-07-23T10:00:00.000Z");

    const newerFailure = deriveTestCaseCatalogue({
      tests: [
        automated("TIME-2", "firefox", "failed", {
          executedAt: "2026-07-23T10:00:00.000Z"
        }),
        automated("TIME-2", "chromium", "passed", {
          executedAt: "2026-07-10T10:00:00.000Z"
        })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(newerFailure.latestResult?.status).toBe("failed");
    expect(newerFailure.lastExecutedAt).toBe("2026-07-23T10:00:00.000Z");
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
    expect(durations.duration?.latestMs).toBeUndefined();
  });

  it("counts execution-level stability samples instead of implementation variants", () => {
    const automatedVariants = [
      automated("STABLE-1", "chromium", "passed", {
        variant: { browser: "chromium" },
        executedAt: "2026-07-23T09:00:00.000Z"
      }),
      automated("STABLE-1", "firefox", "failed", {
        variant: { browser: "firefox" },
        executedAt: "2026-07-23T09:00:00.000Z"
      })
    ];
    const automatedOnly = deriveTestCaseCatalogue({
      tests: automatedVariants,
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(automatedOnly.stability).toMatchObject({
      available: false,
      sampleSize: 1,
      passed: 0,
      failed: 1,
      flaky: 0
    });

    const hybrid = deriveTestCaseCatalogue({
      tests: automatedVariants.map((test) => ({
        ...test,
        identity: { ...test.identity!, canonicalId: "HYBRID-STABILITY" },
        name: "HYBRID-STABILITY manual verification"
      })),
      manualCases: [manualCase("HYBRID-STABILITY")],
      manualExecutions: [
        manualExecution("manual-one", "HYBRID-STABILITY", "passed", "2026-07-22T10:00:00.000Z"),
        manualExecution("manual-two", "HYBRID-STABILITY", "passed", "2026-07-23T10:00:00.000Z")
      ],
      metadata
    })[0]!;
    expect(hybrid.stability).toMatchObject({
      available: true,
      sampleSize: 3,
      passed: 2,
      failed: 1,
      passRate: 66.67
    });
    expect(
      deriveTestCaseCatalogue({
        tests: [...automatedVariants].reverse(),
        manualCases: [],
        manualExecutions: [],
        metadata
      })[0]!.stability
    ).toEqual(automatedOnly.stability);
  });

  it("selects latest duration deterministically and omits latest without reliable time", () => {
    const input = [
      automated("DURATION-ORDER", "b", "passed", {
        durationMs: 20,
        executedAt: "2026-07-23T10:00:00.000Z"
      }),
      automated("DURATION-ORDER", "a", "passed", {
        durationMs: 10,
        executedAt: "2026-07-23T10:00:00.000Z"
      }),
      automated("DURATION-ORDER", "newest", "passed", {
        durationMs: 30,
        executedAt: "2026-07-23T11:00:00.000Z"
      }),
      { ...automated("DURATION-ORDER", "invalid", "passed"), durationMs: Number.NaN },
      { ...automated("DURATION-ORDER", "negative", "passed"), durationMs: -1 }
    ];
    const forward = deriveTestCaseCatalogue({
      tests: input,
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!.duration;
    const reversed = deriveTestCaseCatalogue({
      tests: [...input].reverse(),
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!.duration;
    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({ sampleSize: 3, latestMs: 30, medianMs: 20 });

    const equalTimestamp = deriveTestCaseCatalogue({
      tests: input.slice(0, 2),
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!.duration;
    expect(equalTimestamp?.latestMs).toBe(10);

    const missingTimestamp = deriveTestCaseCatalogue({
      tests: [
        automated("NO-TIME", "b", "passed", { durationMs: 20 }),
        automated("NO-TIME", "a", "passed", { durationMs: 10 })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!.duration;
    expect(missingTimestamp).toMatchObject({ sampleSize: 2, averageMs: 15 });
    expect(missingTimestamp?.latestMs).toBeUndefined();
  });

  it("derives several thousand entries in a linear grouping pass", () => {
    const tests = Array.from({ length: 5000 }, (_, index) =>
      automated(`PERF-${Math.floor(index / 5)}`, `technical-${index}`, "passed", {
        variant: { browser: `browser-${index % 5}` }
      })
    );
    const start = performance.now();
    const catalogue = deriveTestCaseCatalogue({ tests, manualCases: [], manualExecutions: [], metadata });
    expect(catalogue).toHaveLength(1000);
    expect(catalogue.every((item) => item.implementations.length === 5)).toBe(true);
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
      type: "automated",
      reportedAt: metadata.generatedAt,
      testCaseIds: ["AUTO-1"],
      requirementIds: ["REQ-A"],
      defectIds: ["BUG-A"],
      caseResults: [{ testCaseId: "AUTO-1", implementationId: "one", status: "passed" }]
    });
    expect(executions[1]).toMatchObject({
      type: "manual",
      status: "failed",
      testCaseIds: ["MANUAL-1"],
      requirementIds: ["REQ-M"],
      defectIds: ["BUG-1"],
      caseResults: [
        {
          testCaseId: "MANUAL-1",
          status: "failed",
          evidenceReferences: ["proof.png"],
          defects: ["BUG-1"]
        }
      ]
    });
  });

  it("keeps execution snapshots independent from the catalogue latest result", () => {
    const definitions = [manualCase("CASE-1")];
    const manualExecutions = [
      manualExecution("A", "CASE-1", "passed", "2026-07-22T10:00:00.000Z"),
      manualExecution("B", "CASE-1", "failed", "2026-07-23T10:00:00.000Z")
    ];
    const input = { tests: [], manualCases: definitions, manualExecutions, metadata };
    const executions = deriveUnifiedExecutions(input);
    expect(executions.find((item) => item.id === "A")?.caseResults[0]?.status).toBe("passed");
    expect(executions.find((item) => item.id === "B")?.caseResults[0]?.status).toBe("failed");
    expect(deriveTestCaseCatalogue(input)[0]?.latestResult?.status).toBe("failed");
  });

  it("preserves manual snapshot notes, defects, and evidence references", () => {
    const execution = ManualExecutionSchema.parse({
      ...manualExecution("notes", "CASE-1", "failed", "2026-07-23T10:00:00.000Z"),
      cases: [
        {
          caseId: "CASE-1",
          status: "failed",
          steps: [
            {
              index: 0,
              status: "failed",
              actualResult: "Step failed",
              notes: "Step note",
              evidence: ["step.png"]
            }
          ],
          actualResult: "Case failed",
          notes: "Case note",
          defects: ["BUG-2"],
          evidence: ["case.txt"]
        }
      ]
    });
    const result = deriveUnifiedExecutions({
      tests: [],
      manualCases: [manualCase("CASE-1")],
      manualExecutions: [execution],
      metadata
    })[0]!.caseResults[0]!;
    expect(result).toMatchObject({
      status: "failed",
      defects: ["BUG-2"],
      evidenceReferences: ["case.txt", "step.png"],
      notes: ["Case failed", "Case note", "Step failed", "Step note"]
    });
  });

  it.each([
    [["passed", "skipped"], "passed"],
    [["skipped", "skipped"], "incomplete"],
    [["passed", "failed", "skipped"], "failed"],
    [["passed", "unknown"], "unknown"]
  ] as const)("derives automated execution status for %j as %s", (statuses, expected) => {
    const execution = deriveUnifiedExecutions({
      tests: statuses.map((status, index) => automated(`CASE-${index}`, `tech-${index}`, status)),
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(execution.status).toBe(expected);
  });

  it("separates report time, summed test time, and wall-clock duration", () => {
    const execution = deriveUnifiedExecutions({
      tests: [
        automated("A", "a", "passed", { durationMs: 100 }),
        automated("B", "b", "skipped", { durationMs: 50 })
      ],
      manualCases: [],
      manualExecutions: [],
      metadata
    })[0]!;
    expect(execution.reportedAt).toBe(metadata.generatedAt);
    expect(execution.completedAt).toBeUndefined();
    expect(execution.startedAt).toBeUndefined();
    expect(execution.durationMs).toBeUndefined();
    expect(execution.testDurationSumMs).toBe(150);
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
