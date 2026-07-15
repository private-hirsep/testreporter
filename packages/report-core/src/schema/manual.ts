import { z } from "zod";

const Text = z.string().trim().min(1).max(10000);
export const ManualStatusSchema = z.enum(["not-run", "passed", "failed", "blocked", "skipped"]);
export const ManualCaseSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(500),
    description: z.string().max(10000).optional(),
    status: z.enum(["draft", "approved", "deprecated"]).default("draft"),
    priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    risk: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    requirements: z.array(Text).default([]),
    tags: z.array(Text).default([]),
    owner: Text.optional(),
    estimatedMinutes: z.number().int().positive().optional(),
    preconditions: z.array(Text).default([]),
    steps: z.array(z.object({ action: Text, expected: Text })).min(1),
    sourcePath: z.string().optional(),
    revision: z.string().optional()
  })
  .strict();
export const ManualStepResultSchema = z.object({
  index: z.number().int().nonnegative(),
  status: ManualStatusSchema,
  actualResult: z.string().max(10000).optional(),
  notes: z.string().max(10000).optional(),
  evidence: z.array(Text).default([])
});
export const ManualCaseResultSchema = z.object({
  caseId: Text,
  caseRevision: z.string().optional(),
  status: ManualStatusSchema,
  steps: z.array(ManualStepResultSchema),
  actualResult: z.string().max(10000).optional(),
  notes: z.string().max(10000).optional(),
  defects: z.array(Text).default([]),
  evidence: z.array(Text).default([])
});
export const ManualExecutionSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    executionId: Text,
    projectKey: Text,
    release: z.string().max(500).optional(),
    testedBuild: Text,
    environment: Text,
    tester: Text,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    sourceCommit: z.string().optional(),
    state: z.enum(["draft", "completed"]),
    cases: z.array(ManualCaseResultSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    value.cases.forEach((item, index) => {
      if (ids.has(item.caseId))
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "caseId"],
          message: "Duplicate case ID"
        });
      ids.add(item.caseId);
      if (value.state === "completed" && item.status === "not-run")
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "status"],
          message: "Completed executions cannot contain not-run cases"
        });
    });
    if (value.state === "completed" && !value.completedAt)
      ctx.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Completed execution requires completedAt"
      });
  });
export function calculateManualCaseStatus(
  steps: Array<{ status: z.infer<typeof ManualStatusSchema> }>
) {
  if (!steps.length || steps.every((s) => s.status === "not-run")) return "not-run" as const;
  if (steps.some((s) => s.status === "failed")) return "failed" as const;
  if (steps.some((s) => s.status === "blocked")) return "blocked" as const;
  if (steps.every((s) => s.status === "skipped")) return "skipped" as const;
  if (steps.every((s) => s.status === "passed" || s.status === "skipped")) return "passed" as const;
  return "not-run" as const;
}
export type ManualCase = z.infer<typeof ManualCaseSchema>;
export type ManualExecution = z.infer<typeof ManualExecutionSchema>;
export type ManualStatus = z.infer<typeof ManualStatusSchema>;
