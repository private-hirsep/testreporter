import type { NormalizedTestCase } from "../schema/report.js";
import { stableId } from "../utils/hash.js";
import { analyzeCanonicalIdentityGroup } from "../catalogue/identity.js";

export function extractRequirementKeys(text: string | undefined, pattern: RegExp): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))];
}

export function testIdentity(test: NormalizedTestCase): string {
  return stableId([
    test.framework,
    test.layer,
    test.suite,
    test.name,
    test.file,
    test.line,
    ...Object.entries(test.variant ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .flat()
  ]);
}

export function deduplicateTests(tests: NormalizedTestCase[]): NormalizedTestCase[] {
  const grouped = new Map<string, NormalizedTestCase[]>();
  for (const test of tests) {
    const key = testIdentity(test);
    const current = grouped.get(key);
    if (current) current.push(test);
    else grouped.set(key, [test]);
  }

  return [...grouped.values()].map((group) => {
    const selected = group.at(-1)!;
    return {
      ...selected,
      id: testIdentity(selected),
      retries: Math.max(
        group.some((test) => test.retries > 0) ? 0 : group.length - 1,
        ...group.map((test) => test.retries)
      ),
      requirements: [...new Set(group.flatMap((test) => test.requirements))],
      attachments: group.flatMap((test) => test.attachments)
    };
  });
}

export function calculateIdentityDiagnostics(
  tests: NormalizedTestCase[],
  warnings: Array<{ code: string }> = []
) {
  const counts = { explicit: 0, "title-token": 0, mapping: 0, generated: 0 };
  const ids = new Map<string, NormalizedTestCase[]>();
  for (const test of tests) {
    const source = test.identity?.source ?? "generated";
    counts[source] += 1;
    const canonical = test.identity?.canonicalId ?? test.id;
    const group = ids.get(canonical);
    if (group) group.push(test);
    else ids.set(canonical, [test]);
  }
  const analyses = [...ids]
    .map(([canonicalId, values]) =>
      analyzeCanonicalIdentityGroup(
        canonicalId,
        values.map((test) => ({
          title: test.name,
          ...(test.variant ? { variant: test.variant } : {})
        }))
      )
    )
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  const multiImplementationCanonicalIds = analyses
    .filter((analysis) => analysis.implementationCount > 1 && analysis.compatible)
    .map((analysis) => analysis.canonicalId);
  const conflictingCanonicalIds = analyses
    .filter((analysis) => !analysis.compatible)
    .map((analysis) => analysis.canonicalId);
  const duplicateCanonicalIds = conflictingCanonicalIds;
  const duplicateExplicitIds = [...ids]
    .filter(([id, values]) => {
      const explicit = values.filter((test) => test.identity?.source === "explicit");
      return (
        explicit.length > 1 &&
        !analyzeCanonicalIdentityGroup(
          id,
          explicit.map((test) => ({
            title: test.name,
            ...(test.variant ? { variant: test.variant } : {})
          }))
        ).compatible
      );
    })
    .map(([id]) => id)
    .sort();
  return {
    total: tests.length,
    explicit: counts.explicit,
    titleToken: counts["title-token"],
    mapping: counts.mapping,
    generated: counts.generated,
    duplicateCanonicalIds,
    duplicateExplicitIds,
    multiImplementationCanonicalIds,
    conflictingCanonicalIds,
    malformedExplicitIds: warnings.filter(
      (warning) => warning.code === "identity.explicit.malformed"
    ).length,
    ambiguousMappings: warnings.filter((warning) => warning.code === "identity.mapping.ambiguous")
      .length
  };
}
