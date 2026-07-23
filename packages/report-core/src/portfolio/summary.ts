import { z } from "zod";

const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "reportUrl must use HTTP or HTTPS");

export const ProjectQualitySummarySchema = z.object({
  schemaVersion: z.literal("1.0"),
  projectKey: z.string().min(1),
  projectName: z.string().min(1),
  release: z.string().optional(),
  reportUrl: HttpUrlSchema.optional(),
  generatedAt: z.string().datetime(),
  qualityGate: z.enum(["passed", "failed", "skipped", "not_evaluated"]),
  readiness: z.enum(["ready", "ready-with-accepted-risks", "warning", "blocked", "incomplete"]),
  passedTests: z.number().int().nonnegative(),
  failedTests: z.number().int().nonnegative(),
  newFailures: z.number().int().nonnegative().default(0),
  manualRemaining: z.number().int().nonnegative(),
  uncoveredRequirements: z.number().int().nonnegative(),
  securityBlockers: z.number().int().nonnegative(),
  acceptedRisks: z.number().int().nonnegative(),
  recommendedActions: z.number().int().nonnegative()
});
export type ProjectQualitySummary = z.infer<typeof ProjectQualitySummarySchema>;
export type PortfolioProject = ProjectQualitySummary & { stale: boolean; priority: number };
export function portfolioPriority(
  item: ProjectQualitySummary,
  now = new Date(),
  staleDays = 7
): PortfolioProject {
  const stale = now.getTime() - new Date(item.generatedAt).getTime() > staleDays * 86_400_000;
  const priority =
    item.readiness === "blocked"
      ? 1
      : item.qualityGate === "failed"
        ? 2
        : item.manualRemaining > 0
          ? 3
          : item.uncoveredRequirements > 0
            ? 4
            : item.newFailures > 0
              ? 5
              : item.securityBlockers > 0 || item.readiness === "warning"
                ? 6
                : 7;
  return { ...item, stale, priority: stale ? Math.min(priority, 2) : priority };
}
export function sortPortfolio(items: ProjectQualitySummary[], now = new Date(), staleDays = 7) {
  return items
    .map((item) => portfolioPriority(item, now, staleDays))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        Number(b.stale) - Number(a.stale) ||
        a.projectKey.localeCompare(b.projectKey)
    );
}
