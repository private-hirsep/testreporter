import type { Manifest, TestCase } from "../types";
import { formatPercent } from "../format";
import { overallStatus } from "./context";
import { resolveStatus, type StatusDescriptor } from "./status";

export type SummaryCardItem = {
  label: string;
  value: string | number;
  tone?: "positive" | "negative" | "caution" | "neutral";
};

export type SummaryCard = {
  id: string;
  title: string;
  status: StatusDescriptor;
  headline: string;
  items: SummaryCardItem[];
  to: string;
  linkLabel: string;
  note?: string | undefined;
};

export type AttentionItem = {
  severity: string;
  message: string;
  reference?: string | undefined;
  href?: string | undefined;
  type: string;
};

function count(value: number | undefined): number {
  return value ?? 0;
}

export function buildSummaryCards(manifest: Manifest): SummaryCard[] {
  const cards: SummaryCard[] = [];
  const readiness = manifest.readiness;

  const release = overallStatus(manifest);
  cards.push({
    id: "release",
    title: "Release status",
    status: release.descriptor,
    headline: release.descriptor.label,
    items: readiness
      ? [
          {
            label: "Required actions",
            value: readiness.actions.length,
            tone: readiness.actions.length ? "negative" : "positive"
          },
          {
            label: "Accepted risks",
            value: readiness.acceptedRisks.length,
            tone: "neutral"
          }
        ]
      : [],
    to: "/readiness",
    linkLabel: "Open release readiness",
    note: readiness
      ? undefined
      : "No release readiness data in this report. Regenerate with a release scope to evaluate readiness."
  });

  const testsSummary = manifest.summary.tests;
  const attention = testsSummary.failed + testsSummary.broken;
  cards.push({
    id: "tests",
    title: "Test results",
    status: resolveStatus(attention ? "failed" : testsSummary.total ? "passed" : "unavailable"),
    headline: `${testsSummary.total} test${testsSummary.total === 1 ? "" : "s"}`,
    items: [
      { label: "Passed", value: testsSummary.passed, tone: "positive" },
      {
        label: "Failed",
        value: testsSummary.failed,
        tone: testsSummary.failed ? "negative" : "neutral"
      },
      {
        label: "Broken",
        value: testsSummary.broken,
        tone: testsSummary.broken ? "negative" : "neutral"
      },
      { label: "Skipped", value: testsSummary.skipped, tone: "neutral" }
    ],
    to: "/tests",
    linkLabel: "Open test cases",
    note: testsSummary.total ? undefined : "No automated test results were found in this report."
  });

  const scoped = readiness?.requirements;
  const scopedTotal = scoped ? scoped.covered + scoped.uncovered : 0;
  const requirements = manifest.requirements;
  const uncovered = scoped ? scoped.uncovered : requirements.missing.length;
  cards.push({
    id: "requirements",
    title: scoped ? "Release requirements" : "Requirement coverage",
    status:
      scoped && scopedTotal === 0
        ? resolveStatus("informational")
        : resolveStatus(uncovered ? "missing" : "covered"),
    headline: scoped
      ? scopedTotal === 0
        ? "No scoped requirements"
        : `${scoped.covered} of ${scopedTotal} covered`
      : formatPercent(requirements.percentage),
    items: scoped
      ? [
          { label: "Covered", value: scoped.covered, tone: "positive" },
          { label: "Uncovered", value: scoped.uncovered, tone: uncovered ? "negative" : "neutral" },
          { label: "Excluded", value: scoped.excluded, tone: "neutral" }
        ]
      : [
          { label: "Covered", value: requirements.covered.length, tone: "positive" },
          {
            label: "Missing",
            value: requirements.missing.length,
            tone: requirements.missing.length ? "negative" : "neutral"
          },
          {
            label: "Extra",
            value: requirements.extra.length,
            tone: requirements.extra.length ? "caution" : "neutral"
          }
        ],
    to: "/requirements",
    linkLabel: "Open requirements",
    note:
      scoped && scopedTotal === 0
        ? "The release scope declares no requirements, so scoped coverage cannot be evaluated."
        : undefined
  });

  const manual = readiness?.manual;
  const manualCases = manifest.manualCases ?? [];
  const manualExecutions = manifest.manualExecutions ?? [];
  const manualDone = manual ? count(manual.passed) + count(manual.failed) : undefined;
  const manualRemaining = manual ? count(manual.notRun) + count(manual.blocked) : undefined;
  cards.push({
    id: "executions",
    title: "Executions",
    status: manual
      ? resolveStatus(
          count(manual.failed) + count(manual.blocked)
            ? "failed"
            : count(manual.notRun)
              ? "incomplete"
              : "passed"
        )
      : resolveStatus(manualCases.length ? "informational" : "unavailable"),
    headline: `${testsSummary.total} automated in this run`,
    items: manual
      ? [
          { label: "Manual done", value: manualDone ?? 0, tone: "positive" },
          {
            label: "Manual remaining",
            value: manualRemaining ?? 0,
            tone: manualRemaining ? "caution" : "neutral"
          },
          {
            label: "Manual blocked",
            value: count(manual.blocked),
            tone: count(manual.blocked) ? "negative" : "neutral"
          }
        ]
      : [
          { label: "Manual cases", value: manualCases.length, tone: "neutral" },
          { label: "Imported manual runs", value: manualExecutions.length, tone: "neutral" }
        ],
    to: "/manual",
    linkLabel: "Open manual testing",
    note: manual
      ? undefined
      : manualCases.length
        ? "Manual execution totals appear here when the report has a release scope."
        : "No manual cases are defined in this report."
  });

  return cards;
}

export function attentionItems(
  manifest: Manifest,
  tests: TestCase[] = []
): AttentionItem[] | undefined {
  if (!manifest.readiness) return undefined;
  const testById = new Map(tests.map((test) => [test.id, test]));
  return manifest.readiness.actions.map((action) => {
    // Readiness actions reference tests by opaque ID; resolve to the test name
    // for display without changing the recorded action itself.
    const referenced =
      action.type === "failed-test" && action.reference
        ? testById.get(action.reference)
        : undefined;
    const message =
      referenced && action.reference
        ? action.message.split(action.reference).join(referenced.fullName ?? referenced.name)
        : action.message;
    return {
      severity: action.severity,
      message,
      reference: action.reference,
      href: action.href,
      type: action.type
    };
  });
}

/** Replace opaque test IDs embedded in report text with the test's display name. */
export function resolveTestIds(text: string, tests: TestCase[]): string {
  let resolved = text;
  for (const test of tests) {
    if (resolved.includes(test.id))
      resolved = resolved.split(test.id).join(test.fullName ?? test.name);
  }
  return resolved;
}

export function topFailingTests(tests: TestCase[], limit = 5): TestCase[] {
  const rank: Record<string, number> = { failed: 0, broken: 1 };
  return tests
    .filter((test) => test.status === "failed" || test.status === "broken")
    .sort(
      (a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

export function requirementGaps(manifest: Manifest, limit = 6): string[] {
  const scoped = manifest.readiness?.requirements;
  const gaps = scoped ? scoped.uncoveredIds : manifest.requirements.missing;
  return gaps.slice(0, limit);
}

/**
 * Keys that actually have a row on the Requirements page. Scoped release
 * requirements can reference keys outside the traceability set; linking those
 * would produce anchors that do not exist.
 */
export function knownRequirementKeys(manifest: Manifest): Set<string> {
  return new Set([...manifest.requirements.expected, ...manifest.requirements.extra]);
}

export function requirementLink(manifest: Manifest, key: string): string | undefined {
  return knownRequirementKeys(manifest).has(key)
    ? `/requirements#requirement-${key}`
    : undefined;
}

export function securityBlockerCount(manifest: Manifest): number {
  return count(manifest.summary.security.critical) + count(manifest.summary.security.high);
}

export function hasHistoricalRuns(manifest: Manifest): boolean {
  return (manifest.history?.runs?.length ?? 0) > 1;
}
