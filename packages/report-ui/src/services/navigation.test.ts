import { describe, expect, it } from "vitest";
import { navItems } from "./navigation";

describe("workspace navigation", () => {
  it("presents the QA workflow in order", () => {
    expect(navItems.map((item) => item.title)).toEqual([
      "Overview",
      "Test Cases",
      "Executions",
      "Release Readiness",
      "Requirements",
      "Manual Testing",
      "Coverage",
      "Security",
      "Evidence",
      "Diagnostics"
    ]);
  });

  it("keeps historical route paths for renamed sections", () => {
    const byTitle = new Map(navItems.map((item) => [item.title, item]));
    expect(byTitle.get("Test Cases")!.to).toBe("/tests");
    expect(byTitle.get("Executions")!.to).toBe("/history");
    expect(byTitle.get("Evidence")!.to).toBe("/downloads");
    expect(byTitle.get("Executions")!.aliases).toContain("/executions");
    expect(byTitle.get("Evidence")!.aliases).toContain("/evidence");
  });

  it("gives every item a unique route and an icon", () => {
    expect(new Set(navItems.map((item) => item.to)).size).toBe(navItems.length);
    for (const item of navItems) expect(item.icon).toMatch(/^mdi-/);
  });
});
