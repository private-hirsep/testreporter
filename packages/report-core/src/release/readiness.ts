import { z } from "zod";

export const AcceptedRiskSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  reference: z.string().optional()
});
export const ReleaseScopeSchema = z.object({
  release: z.string().min(1),
  requirements: z.array(z.string().min(1)).default([]),
  requiredManualCases: z.array(z.string().min(1)).default([]),
  acceptedRisks: z.array(AcceptedRiskSchema).default([]),
  excludedRequirements: z
    .array(z.object({ id: z.string().min(1), reason: z.string().min(1) }))
    .default([]),
  notes: z.array(z.string().min(1)).default([]),
  references: z.array(z.string().min(1)).default([])
});

export const ReadinessActionSchema = z.object({
  severity: z.enum(["blocker", "warning", "info"]),
  type: z.enum([
    "failed-test",
    "manual-test-required",
    "requirement-uncovered",
    "missing-evidence",
    "security-finding",
    "accepted-risk",
    "quality-gate-failed",
    "release-scope-mismatch"
  ]),
  project: z.string(),
  reference: z.string().optional(),
  message: z.string(),
  href: z.string().optional()
});
export const ReadinessSchema = z.object({
  status: z.enum(["ready", "ready-with-accepted-risks", "warning", "blocked", "incomplete"]),
  reasons: z.array(z.string()),
  automated: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    missing: z.boolean()
  }),
  manual: z.object({
    passed: z.number(),
    failed: z.number(),
    blocked: z.number(),
    notRun: z.number()
  }),
  requirements: z.object({
    covered: z.number(),
    uncovered: z.number(),
    excluded: z.number(),
    uncoveredIds: z.array(z.string()),
    excludedIds: z.array(z.string())
  }),
  securityBlockers: z.number(),
  qualityGateFailed: z.boolean(),
  acceptedRisks: z.array(AcceptedRiskSchema),
  missingEvidence: z.array(z.string()),
  actions: z.array(ReadinessActionSchema)
});

export type ReleaseScope = z.infer<typeof ReleaseScopeSchema>;
export type Readiness = z.infer<typeof ReadinessSchema>;

export type ReadinessInput = {
  project: string;
  scope?: ReleaseScope;
  tests: Array<{ id: string; status: string }>;
  manualStatuses: Record<string, string>;
  coveredRequirements: string[];
  security: Array<{ id: string; severity: string }>;
  qualityGateStatus: string;
  qualityGateFailures?: Array<{ id: string; label: string; message?: string }>;
  reportRelease?: string;
  missingEvidence?: string[];
};

export function validateReleaseScopeReferences(
  scope: ReleaseScope,
  knownRequirements: Iterable<string>,
  knownManualCases: Iterable<string>
) {
  const requirements = new Set(knownRequirements);
  const manual = new Set(knownManualCases);
  return [
    ...scope.requirements
      .filter((id) => !requirements.has(id))
      .map((id) => ({
        code: "release-scope.unknown-requirement",
        reference: id,
        message: `Unknown requirement ID: ${id}`
      })),
    ...scope.requiredManualCases
      .filter((id) => !manual.has(id))
      .map((id) => ({
        code: "release-scope.unknown-manual-case",
        reference: id,
        message: `Unknown manual case ID: ${id}`
      }))
  ];
}

export function determineReadiness(input: ReadinessInput): Readiness {
  const scope = input.scope;
  const actions: z.infer<typeof ReadinessActionSchema>[] = [];
  const failed = input.tests.filter((test) => ["failed", "broken"].includes(test.status));
  for (const test of failed)
    actions.push({
      severity: "blocker",
      type: "failed-test",
      project: input.project,
      reference: test.id,
      message: `Test ${test.id} failed.`,
      href: `#/tests/${encodeURIComponent(test.id)}`
    });
  const required = scope?.requiredManualCases ?? [];
  const manual = { passed: 0, failed: 0, blocked: 0, notRun: 0 };
  for (const id of required) {
    const status = input.manualStatuses[id] ?? "not-run";
    if (status === "passed") manual.passed++;
    else if (status === "failed") manual.failed++;
    else if (status === "blocked") manual.blocked++;
    else manual.notRun++;
    if (status !== "passed")
      actions.push({
        severity: status === "failed" || status === "blocked" ? "blocker" : "warning",
        type: "manual-test-required",
        project: input.project,
        reference: id,
        message: `Required manual case ${id} is ${status}.`,
        href: "#/manual"
      });
  }
  const covered = new Set(input.coveredRequirements);
  const scopeRequirementIds = [...new Set(scope?.requirements ?? [])];
  const excludedIds = [...new Set(scope?.excludedRequirements.map((item) => item.id) ?? [])];
  const excluded = new Set(excludedIds);
  const uncovered = scopeRequirementIds.filter(
    (id) => !covered.has(id) && !excluded.has(id)
  );
  for (const id of uncovered)
    actions.push({
      severity: "blocker",
      type: "requirement-uncovered",
      project: input.project,
      reference: id,
      message: `Release requirement ${id} is not covered.`,
      href: "#/requirements"
    });
  const securityBlockers = input.security.filter((finding) =>
    ["critical", "high"].includes(finding.severity)
  );
  for (const finding of securityBlockers)
    actions.push({
      severity: "blocker",
      type: "security-finding",
      project: input.project,
      reference: finding.id,
      message: `${finding.severity} security finding ${finding.id} remains visible.`,
      href: "#/security"
    });
  for (const risk of scope?.acceptedRisks ?? [])
    actions.push({
      severity: "info",
      type: "accepted-risk",
      project: input.project,
      reference: risk.reference ?? risk.id,
      message: `Accepted risk ${risk.id}: ${risk.reason}`
    });
  for (const item of input.missingEvidence ?? [])
    actions.push({
      severity: "warning",
      type: "missing-evidence",
      project: input.project,
      reference: item,
      message: `Missing audit evidence: ${item}`
    });
  if (input.qualityGateStatus === "failed") {
    const failures = input.qualityGateFailures?.length
      ? input.qualityGateFailures
      : [{ id: "quality-gate", label: "Quality gate" }];
    for (const failure of failures)
      actions.push({
        severity: "blocker",
        type: "quality-gate-failed",
        project: input.project,
        reference: failure.id,
        message: `${failure.label} failed${failure.message ? `: ${failure.message}` : "."}`
      });
  }
  if (scope && input.reportRelease && scope.release !== input.reportRelease)
    actions.push({
      severity: "blocker",
      type: "release-scope-mismatch",
      project: input.project,
      reference: scope.release,
      message: `Release scope ${scope.release} does not match report release ${input.reportRelease}.`
    });
  const blockers = actions.filter((action) => action.severity === "blocker").length;
  const warnings = actions.filter((action) => action.severity === "warning").length;
  const incomplete = !scope || input.tests.length === 0;
  const status = blockers
    ? "blocked"
    : incomplete
      ? "incomplete"
      : warnings
        ? "warning"
        : (scope?.acceptedRisks.length ?? 0) > 0
          ? "ready-with-accepted-risks"
          : "ready";
  const blockerReasons = actions
    .filter((action) => action.severity === "blocker")
    .map((action) => action.message);
  const reasons = blockers
    ? blockerReasons
    : incomplete
      ? [!scope ? "No release scope was provided." : "No automated test results were provided."]
      : warnings
        ? [`${warnings} warning(s) remain.`]
        : status === "ready-with-accepted-risks"
          ? ["All required checks passed; documented risks were accepted."]
          : ["All required checks and evidence passed."];
  return ReadinessSchema.parse({
    status,
    reasons,
    automated: {
      passed: input.tests.filter((test) => test.status === "passed").length,
      failed: failed.length,
      skipped: input.tests.filter((test) => test.status === "skipped").length,
      missing: input.tests.length === 0
    },
    manual,
    requirements: {
      covered: scopeRequirementIds.filter((id) => covered.has(id) && !excluded.has(id)).length,
      uncovered: uncovered.length,
      excluded: excludedIds.length,
      uncoveredIds: uncovered,
      excludedIds
    },
    securityBlockers: securityBlockers.length,
    qualityGateFailed: input.qualityGateStatus === "failed",
    acceptedRisks: scope?.acceptedRisks ?? [],
    missingEvidence: input.missingEvidence ?? [],
    actions
  });
}
