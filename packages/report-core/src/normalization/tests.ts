import type { NormalizedTestCase } from "../schema/report.js";
import { stableId } from "../utils/hash.js";

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
    const selected = group.at(-1)!;
    return {
      ...selected,
      id: testIdentity(selected),
      retries: Math.max(group.length - 1, ...group.map((test) => test.retries)),
      requirements: [...new Set(group.flatMap((test) => test.requirements))],
      attachments: group.flatMap((test) => test.attachments)
    };
  });
}
