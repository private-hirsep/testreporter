import type { NormalizedTestCase, RequirementCoverage } from "../schema/report.js";

export function calculateRequirementCoverage(
  expectedKeys: string[],
  tests: NormalizedTestCase[]
): RequirementCoverage {
  const expected = [...new Set(expectedKeys)].sort();
  const discovered = [...new Set(tests.flatMap((test) => test.requirements))].sort();
  const expectedSet = new Set(expected);
  const covered = discovered.filter((key) => expectedSet.has(key)).sort();
  const missing = expected.filter((key) => !covered.includes(key));
  const extra = discovered.filter((key) => !expectedSet.has(key)).sort();
  const testsByRequirement: Record<string, string[]> = {};

  for (const test of tests) {
    for (const key of test.requirements) {
      testsByRequirement[key] = [...(testsByRequirement[key] ?? []), test.id];
    }
  }

  return {
    expected,
    covered,
    missing,
    extra,
    percentage:
      expected.length === 0 ? 100 : Math.round((covered.length / expected.length) * 10000) / 100,
    testsByRequirement,
    manualCasesByRequirement: {},
    latestManualResultByRequirement: {},
    evidenceTypeByRequirement: {}
  };
}
