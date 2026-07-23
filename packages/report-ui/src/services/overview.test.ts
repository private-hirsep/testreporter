import { describe, expect, it } from "vitest";
import { makeManifest, makeTest } from "./fixtures";
import {
  attentionItems,
  buildSummaryCards,
  hasHistoricalRuns,
  requirementGaps,
  resolveTestIds,
  securityBlockerCount,
  topFailingTests
} from "./overview";
import type { Manifest } from "../types";

describe("overview summary cards", () => {
  it("builds four decision-focused cards from a complete manifest", () => {
    const cards = buildSummaryCards(makeManifest());
    expect(cards.map((card) => card.id)).toEqual([
      "release",
      "tests",
      "requirements",
      "executions"
    ]);
    const release = cards[0]!;
    expect(release.status.key).toBe("blocked");
    expect(release.items[0]).toMatchObject({ label: "Required actions", value: 2 });
    const tests = cards[1]!;
    expect(tests.headline).toBe("10 tests");
    expect(tests.status.key).toBe("failed");
  });

  it("uses release-scoped requirement counts when readiness exists", () => {
    const requirements = buildSummaryCards(makeManifest())[2]!;
    expect(requirements.title).toBe("Release requirements");
    expect(requirements.headline).toBe("1 of 2 covered");
  });

  it("does not claim coverage when the release scope has no requirements", () => {
    const manifest = makeManifest();
    manifest.readiness = {
      ...manifest.readiness!,
      requirements: { covered: 0, uncovered: 0, excluded: 0, uncoveredIds: [], excludedIds: [] }
    };
    const requirements = buildSummaryCards(manifest)[2]!;
    expect(requirements.headline).toBe("No scoped requirements");
    expect(requirements.status.key).toBe("informational");
  });

  it("falls back to overall requirement coverage without readiness", () => {
    const manifest = makeManifest();
    delete (manifest as Partial<Manifest>).readiness;
    const requirements = buildSummaryCards(manifest)[2]!;
    expect(requirements.title).toBe("Requirement coverage");
    expect(requirements.headline).toBe("66.7%");
  });

  it("marks the release card unavailable with an honest note when readiness is missing", () => {
    const manifest = makeManifest();
    delete (manifest as Partial<Manifest>).readiness;
    manifest.qualityGate = { status: "skipped", checks: [] };
    const release = buildSummaryCards(manifest)[0]!;
    expect(release.status.key).toBe("unavailable");
    expect(release.note).toContain("release scope");
  });

  it("reports a ready release when nothing needs attention", () => {
    const manifest = makeManifest();
    manifest.readiness = {
      ...manifest.readiness!,
      status: "ready",
      reasons: [],
      actions: [],
      manual: { passed: 2, failed: 0, blocked: 0, notRun: 0 }
    };
    const cards = buildSummaryCards(manifest);
    expect(cards[0]!.status.key).toBe("ready");
    expect(cards[3]!.status.key).toBe("passed");
  });
});

describe("overview attention and secondary panels", () => {
  it("returns undefined attention items when readiness is unavailable", () => {
    const manifest = makeManifest();
    delete (manifest as Partial<Manifest>).readiness;
    expect(attentionItems(manifest)).toBeUndefined();
  });

  it("resolves failed-test references to readable test names", () => {
    const items = attentionItems(makeManifest(), [makeTest()])!;
    expect(items[0]!.message).toBe("Test UserServiceTest > rejects duplicate email failed.");
    expect(items[0]!.reference).toBe("abc123");
    expect(items[1]!.message).toBe("Required manual case MT-1 is not-run.");
  });

  it("replaces embedded test IDs in free-form report text", () => {
    expect(resolveTestIds("Test abc123 failed.", [makeTest()])).toBe(
      "Test UserServiceTest > rejects duplicate email failed."
    );
    expect(resolveTestIds("No ids here.", [makeTest()])).toBe("No ids here.");
  });

  it("ranks failed tests before broken ones and caps the list", () => {
    const tests = [
      makeTest({ id: "1", name: "b", status: "broken" }),
      makeTest({ id: "2", name: "a", status: "failed" }),
      makeTest({ id: "3", name: "c", status: "passed" }),
      ...Array.from({ length: 6 }, (_, index) =>
        makeTest({ id: `f${index}`, name: `f${index}`, status: "failed" })
      )
    ];
    const top = topFailingTests(tests, 5);
    expect(top).toHaveLength(5);
    expect(top.every((test) => test.status === "failed")).toBe(true);
  });

  it("derives gaps and security blockers from existing data only", () => {
    const manifest = makeManifest();
    expect(requirementGaps(manifest)).toEqual(["REQ-3"]);
    expect(securityBlockerCount(manifest)).toBe(1);
    delete (manifest as Partial<Manifest>).readiness;
    expect(requirementGaps(manifest)).toEqual(["REQ-3"]);
  });

  it("treats a single recorded run as having no history", () => {
    const manifest = makeManifest();
    expect(hasHistoricalRuns(manifest)).toBe(false);
    manifest.history = {
      runs: [
        {
          id: "1",
          generatedAt: "2026-07-01T00:00:00.000Z",
          qualityGateStatus: "passed",
          testsTotal: 1,
          testsFailed: 0,
          criticalFindings: 0,
          highFindings: 0
        },
        {
          id: "2",
          generatedAt: "2026-07-02T00:00:00.000Z",
          qualityGateStatus: "passed",
          testsTotal: 1,
          testsFailed: 0,
          criticalFindings: 0,
          highFindings: 0
        }
      ]
    };
    expect(hasHistoricalRuns(manifest)).toBe(true);
  });
});
