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
  ,history: z.object({
    schemaVersion: z.literal("1.0"),
    available: z.boolean(),
    retainedRunCount: z.number().int().nonnegative(),
    oldestRunAt: z.string().optional(),
    newestRunAt: z.string().optional(),
    previousReadiness: z.enum(["ready", "ready-with-accepted-risks", "warning", "blocked", "incomplete"]).optional(),
    previousQualityGate: z.enum(["passed", "failed", "skipped", "not_evaluated"]).optional(),
    newFailures: z.number().int().nonnegative().default(0),
    persistentFailures: z.number().int().nonnegative().default(0),
    recovered: z.number().int().nonnegative().default(0),
    removedOrMissing: z.number().int().nonnegative().default(0),
    unstableCases: z.number().int().nonnegative().default(0),
    slowRegressions: z.number().int().nonnegative().default(0),
    trendAvailable: z.boolean(),
    sparkline: z.array(z.object({
      runId: z.string(),
      reportedAt: z.string(),
      status: z.string(),
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      broken: z.number().int().nonnegative()
    })).max(12)
  }).optional()
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
        : (item.history?.newFailures ?? item.newFailures) > 0
          ? 3
          : (item.history?.persistentFailures ?? 0) > 0
            ? 4
            : item.manualRemaining > 0
              ? 5
              : item.uncoveredRequirements > 0
                ? 6
                : item.securityBlockers > 0
                  ? 7
                  : (item.history?.slowRegressions ?? 0) > 0
                    ? 8
                    : (item.history?.unstableCases ?? 0) > 0
                      ? 9
                      : stale
                        ? 10
                        : item.readiness === "warning" || item.readiness === "incomplete"
                          ? 11
                          : 12;
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
