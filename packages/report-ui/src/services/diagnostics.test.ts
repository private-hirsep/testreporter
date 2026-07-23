import { describe, expect, it } from "vitest";
import { groupWarnings, identityIssues } from "./diagnostics";
import { makeManifest } from "./fixtures";

describe("diagnostics grouping", () => {
  it("groups warnings into severity-ordered categories by code", () => {
    const categories = groupWarnings([
      { code: "sarif.malformed", message: "bad sarif", sourcePath: "a.sarif" },
      { code: "release-scope.unknown-requirement", message: "Unknown requirement ID: X" },
      { code: "git.history-unavailable", message: "no git" },
      { code: "test-mapping.ambiguous", message: "ambiguous mapping" },
      { code: "identity.duplicate-id", message: "duplicate" },
      { code: "evidence.missing", message: "missing file" }
    ]);
    expect(categories.map((category) => category.id)).toEqual([
      "identity",
      "mapping",
      "configuration",
      "git",
      "evidence",
      "compatibility"
    ]);
    expect(categories.find((category) => category.id === "compatibility")!.warnings).toHaveLength(
      1
    );
  });

  it("omits categories without warnings", () => {
    const categories = groupWarnings([{ code: "sarif.malformed", message: "bad" }]);
    expect(categories).toHaveLength(1);
    expect(categories[0]!.id).toBe("compatibility");
    expect(groupWarnings([])).toHaveLength(0);
  });

  it("summarizes identity issues only when they exist", () => {
    const clean = makeManifest({
      identityDiagnostics: {
        total: 5,
        explicit: 5,
        titleToken: 0,
        mapping: 0,
        generated: 0,
        duplicateCanonicalIds: [],
        duplicateExplicitIds: [],
        malformedExplicitIds: 0,
        ambiguousMappings: 0
      }
    });
    expect(identityIssues(clean)).toHaveLength(0);
    const dirty = makeManifest({
      identityDiagnostics: {
        total: 5,
        explicit: 1,
        titleToken: 1,
        mapping: 1,
        generated: 2,
        duplicateCanonicalIds: ["TC-1"],
        duplicateExplicitIds: [],
        malformedExplicitIds: 2,
        ambiguousMappings: 0
      }
    });
    const issues = identityIssues(dirty);
    expect(issues.map((issue) => issue.label)).toEqual([
      "Conflicting canonical IDs",
      "Malformed explicit metadata"
    ]);
  });
});
