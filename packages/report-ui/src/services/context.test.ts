import { describe, expect, it } from "vitest";
import { buildProjectContext, formatContextDate, overallStatus } from "./context";
import { makeManifest } from "./fixtures";
import type { Manifest } from "../types";

describe("project context header", () => {
  it("builds identity and provenance lines from complete metadata", () => {
    const context = buildProjectContext(makeManifest());
    expect(context.projectName).toBe("Demo Tool");
    expect(context.identityParts).toEqual(["Release 1.1.7", "main", "staging"]);
    expect(context.provenanceParts).toEqual([
      "Last tested 23 Jul 2026",
      "build build-117",
      "commit 8f91c2a4d21b",
      "workflow #1842"
    ]);
    expect(context.overallStatus.key).toBe("blocked");
    expect(context.overallStatusSource).toBe("readiness");
  });

  it("omits missing fields instead of rendering placeholders", () => {
    const manifest = makeManifest();
    manifest.metadata = { projectName: "Bare", generatedAt: "2026-07-01T00:00:00.000Z" };
    const context = buildProjectContext(manifest);
    expect(context.identityParts).toEqual([]);
    expect(context.provenanceParts).toEqual(["Last tested 01 Jul 2026"]);
    expect(context.provenanceParts.join(" ")).not.toContain("undefined");
  });

  it("handles a missing manifest without crashing", () => {
    const context = buildProjectContext(undefined);
    expect(context.projectName).toBe("Quality Report");
    expect(context.identityParts).toEqual([]);
    expect(context.overallStatus.key).toBe("unavailable");
  });

  it("falls back to quality gate status when readiness is absent", () => {
    const manifest = makeManifest();
    delete (manifest as Partial<Manifest>).readiness;
    const status = overallStatus(manifest);
    expect(status.source).toBe("quality-gate");
    expect(status.descriptor.color).toBe("success");
    expect(status.descriptor.label).toBe("Quality gate passed");
  });

  it("reports unavailable when neither readiness nor an evaluated gate exists", () => {
    const manifest = makeManifest();
    delete (manifest as Partial<Manifest>).readiness;
    manifest.qualityGate = { status: "skipped", checks: [] };
    const status = overallStatus(manifest);
    expect(status.source).toBe("unavailable");
    expect(status.descriptor.key).toBe("unavailable");
  });

  it("ignores unparsable dates", () => {
    expect(formatContextDate("not-a-date")).toBeUndefined();
    expect(formatContextDate(undefined)).toBeUndefined();
  });
});
