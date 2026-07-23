import { describe, expect, it } from "vitest";
import { auditFiles, groupEvidence } from "./evidence";
import { makeManifest } from "./fixtures";
import type { Download } from "../types";

function download(id: string, category: string): Download {
  return { id, name: `${id}.file`, category, path: `raw/${id}.file`, sizeBytes: 10 };
}

describe("evidence grouping", () => {
  it("orders known categories with the audit package first", () => {
    const manifest = makeManifest({
      downloads: [
        download("cov", "coverage"),
        download("zip", "report"),
        download("junit", "tests"),
        download("case", "manual"),
        download("scope", "requirements"),
        download("sarif", "security")
      ]
    });
    const groups = groupEvidence(manifest);
    expect(groups.map((group) => group.category)).toEqual([
      "report",
      "tests",
      "manual",
      "requirements",
      "coverage",
      "security"
    ]);
    expect(groups[0]!.label).toBe("Audit package");
  });

  it("keeps unknown categories visible instead of dropping them", () => {
    const groups = groupEvidence(makeManifest({ downloads: [download("x", "mystery")] }));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("other");
  });

  it("returns no groups for a report without downloads", () => {
    expect(groupEvidence(makeManifest({ downloads: [] }))).toHaveLength(0);
  });

  it("declares both static integrity files with descriptions", () => {
    expect(auditFiles.map((file) => file.path)).toEqual([
      "evidence-manifest.json",
      "checksums.sha256"
    ]);
    for (const file of auditFiles) expect(file.description.length).toBeGreaterThan(0);
  });
});
