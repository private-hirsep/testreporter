import type { NormalizedTestCase } from "../schema/report.js";
import { stableId } from "../utils/hash.js";

const statusRank: Record<NormalizedTestCase["status"], number> = {
  broken: 5,
  failed: 4,
  unknown: 3,
  skipped: 2,
  passed: 1
};

export function extractRequirementKeys(text: string | undefined, pattern: RegExp): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))];
}

export function testIdentity(test: NormalizedTestCase): string {
  return stableId([test.framework, test.layer, test.suite, test.name, test.file, test.line]);
}

export function deduplicateTests(tests: NormalizedTestCase[]): NormalizedTestCase[] {
  const grouped = new Map<string, NormalizedTestCase[]>();
  for (const test of tests) {
    const key = testIdentity(test);
    const current = grouped.get(key) ?? [];
    current.push(test);
    grouped.set(key, current);
  }

  return [...grouped.values()].map((group) => {
    const sorted = [...group].sort((a: NormalizedTestCase, b: NormalizedTestCase) => {
      const rankDelta = statusRank[b.status] - statusRank[a.status];
      if (rankDelta !== 0) return rankDelta;
      return (b.durationMs ?? 0) - (a.durationMs ?? 0);
    });
    const selected = sorted[0]!;
    return {
      ...selected,
      id: testIdentity(selected),
      retries: Math.max(group.length - 1, ...group.map((test) => test.retries)),
      requirements: [...new Set(group.flatMap((test) => test.requirements))],
      attachments: group.flatMap((test) => test.attachments)
    };
  });
}
