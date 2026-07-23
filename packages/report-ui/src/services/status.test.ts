import { describe, expect, it } from "vitest";
import { resolveStatus } from "./status";

describe("status semantics registry", () => {
  it.each([
    ["passed", "Passed", "success", "mdi-check-circle"],
    ["ready", "Ready", "success", "mdi-check-decagram"],
    ["ready-with-accepted-risks", "Ready with accepted risks", "success", "mdi-check-decagram-outline"],
    ["failed", "Failed", "error", "mdi-close-circle"],
    ["blocked", "Blocked", "error", "mdi-cancel"],
    ["warning", "Warning", "warning", "mdi-alert"],
    ["incomplete", "Incomplete", "warning", "mdi-progress-alert"],
    ["not-run", "Not run", "grey", "mdi-circle-outline"],
    ["skipped", "Skipped", "warning", "mdi-debug-step-over"],
    ["accepted-risk", "Accepted risk", "info", "mdi-scale-balance"],
    ["unavailable", "Unavailable", "grey", "mdi-help-circle-outline"],
    ["unknown", "Unknown", "grey", "mdi-help-circle-outline"]
  ])("maps %s to a consistent label, color, and icon", (key, label, color, icon) => {
    const descriptor = resolveStatus(key);
    expect(descriptor.label).toBe(label);
    expect(descriptor.color).toBe(color);
    expect(descriptor.icon).toBe(icon);
    expect(descriptor.description.length).toBeGreaterThan(0);
  });

  it("shares one descriptor across aliases of the same semantic state", () => {
    expect(resolveStatus("not_evaluated")).toEqual(resolveStatus("unavailable"));
    expect(resolveStatus("uncovered")).toEqual(resolveStatus("missing"));
    expect(resolveStatus("not_run")).toEqual(resolveStatus("not-run"));
  });

  it("keeps unknown distinct from unavailable", () => {
    expect(resolveStatus("unknown").label).toBe("Unknown");
    expect(resolveStatus("unavailable").label).toBe("Unavailable");
  });

  it("is case-insensitive and falls back safely for unknown values", () => {
    expect(resolveStatus("PASSED").key).toBe("passed");
    const unknown = resolveStatus("mystery-state");
    expect(unknown.color).toBe("grey");
    expect(unknown.label).toBe("mystery-state");
  });

  it("never leaves a status without an icon so color is not the only signal", () => {
    for (const key of ["passed", "failed", "warning", "skipped", "unavailable", "whatever"]) {
      expect(resolveStatus(key).icon).toMatch(/^mdi-/);
    }
  });
});
