import { describe, expect, it } from "vitest";
import { parseManualCase, parseManualExecution } from "../src/index.js";
describe("manual adapters", () => {
  it("parses YAML and round-trips execution JSON", () => {
    expect(
      parseManualCase(
        "id: APP-MT-1\ntitle: Check\nsteps:\n  - action: Act\n    expected: Observe\n",
        "case.yml"
      ).items[0]?.id
    ).toBe("APP-MT-1");
    const input = {
      schemaVersion: "1.0",
      executionId: "run",
      projectKey: "APP",
      testedBuild: "build",
      environment: "test",
      tester: "Tester",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T01:00:00.000Z",
      state: "completed",
      cases: []
    };
    expect(parseManualExecution(JSON.stringify(input), "result.json").items[0]).toEqual(input);
  });
  it("reports invalid YAML", () => {
    expect(parseManualCase("id: [", "bad.yml").warnings[0]?.code).toBe("manual.case.invalid");
  });
});
