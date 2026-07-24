import type { HistoryArtifact, Manifest, TestCase } from "../types";
import { z } from "zod";

const url = z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const status = z.enum(["passed", "failed", "broken", "blocked", "not-run", "skipped", "unknown"]);
const counts = z.object({ total: z.number().int().nonnegative(), passed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), broken: z.number().int().nonnegative(), blocked: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), notRun: z.number().int().nonnegative(), unknown: z.number().int().nonnegative() });
const source = z.object({ url: url.optional(), evidenceUrl: url.optional() }).optional();
const result = z.object({ testCaseId: z.string(), implementationId: z.string().optional(), status, durationMs: z.number().nonnegative().optional(), attemptCount: z.number().int().positive().optional(), flakyInRun: z.boolean().optional(), identity: z.object({ source: z.string(), stable: z.boolean(), conflict: z.boolean() }) });
const sample = z.object({ executionId: z.string(), type: z.enum(["automated", "manual"]), at: z.string().datetime(), status: z.enum([...status.options, "absent"]), presence: z.enum(["present", "absent"]), branch: z.string().optional(), environment: z.string().optional(), release: z.string().optional(), commit: z.string().optional(), durationMs: z.number().nonnegative().optional(), implementationResults: z.array(result).optional(), sourceReport: source });
const transition = z.enum(["newly-failing", "first-observed-failing", "persistently-failing", "recovered", "still-blocked", "newly-blocked", "not-executed", "new-case", "removed-or-missing", "unchanged"]);
const duration = z.object({ latestMs: z.number().nonnegative(), medianMs: z.number().nonnegative(), previousMs: z.number().nonnegative().optional(), absoluteChangeMs: z.number().optional(), percentageChange: z.number().finite().optional(), recentMedianMs: z.number().nonnegative(), slowRegression: z.boolean() });
const stream = z.object({ key: z.string(), type: z.enum(["automated", "manual"]), branch: z.string().optional(), environment: z.string().optional(), samples: z.array(sample), currentStatus: z.string().optional(), previousStatus: z.string().optional(), transition, sampleSize: z.number().int().nonnegative(), passed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), passRate: z.number().min(0).max(100).optional(), consecutiveFailures: z.number().int().nonnegative(), lastPassedAt: z.string().datetime().optional(), lastFailedAt: z.string().datetime().optional(), stability: z.enum(["insufficient-history", "stable", "historically-unstable", "identity-conflict"]), passFailTransitions: z.number().int().nonnegative(), duration: duration.optional() });
const OptimizedHistoryArtifactSchema = z.object({
  schemaVersion: z.literal("1.0"), project: z.object({ key: z.string(), name: z.string() }), generatedAt: z.string().datetime(),
  retention: z.object({ maxRuns: z.number().int().positive(), maxAgeDays: z.number().int().positive(), maxManualExecutions: z.number().int().positive(), prunedRuns: z.number().int().nonnegative(), prunedManualExecutions: z.number().int().nonnegative() }),
  availability: z.enum(["unavailable", "insufficient", "available"]),
  runs: z.array(z.object({ id: z.string(), type: z.literal("automated"), projectKey: z.string(), release: z.string().optional(), branch: z.string().optional(), environment: z.string().optional(), commit: z.string().optional(), workflowRun: z.string().optional(), workflowAttempt: z.number().int().positive().optional(), reportedAt: z.string().datetime(), startedAt: z.string().datetime().optional(), completedAt: z.string().datetime().optional(), wallClockDurationMs: z.number().nonnegative().optional(), testDurationSumMs: z.number().nonnegative().optional(), status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]), counts, qualityGate: z.object({ status: z.string(), profile: z.string().optional() }).optional(), readiness: z.object({ status: z.string(), blockers: z.number().int().nonnegative(), warnings: z.number().int().nonnegative(), acceptedRisks: z.number().int().nonnegative() }).optional(), caseResults: z.array(result), sourceReport: source })),
  manualExecutions: z.array(z.object({ executionId: z.string(), projectKey: z.string(), release: z.string().optional(), environment: z.string().optional(), testedBuild: z.string().optional(), tester: z.string().optional(), startedAt: z.string().datetime(), completedAt: z.string().datetime(), status: z.enum(["passed", "failed", "blocked", "incomplete", "unknown"]), caseResults: z.array(z.object({ testCaseId: z.string(), status })), sourceReport: source })),
  cases: z.array(z.object({ testCaseId: z.string(), streams: z.array(stream), aggregateCurrentStatus: z.string().optional(), transition, sampleSize: z.number().int().nonnegative(), passed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), consecutiveFailures: z.number().int().nonnegative(), identityConfidence: z.enum(["trusted", "generated-low", "conflicted"]), stability: z.string(), passFailTransitions: z.number().int().nonnegative(), duration: duration.optional() }).passthrough()),
  trends: z.object({ runCount: z.number().int().nonnegative(), oldestAt: z.string().datetime().optional(), newestAt: z.string().datetime().optional(), newFailures: z.number().int().nonnegative(), persistentFailures: z.number().int().nonnegative(), recovered: z.number().int().nonnegative(), removedOrMissing: z.number().int().nonnegative(), unstable: z.number().int().nonnegative(), slowRegressions: z.number().int().nonnegative() }),
  diagnostics: z.array(z.object({ severity: z.enum(["error", "warning", "information"]), code: z.string(), message: z.string(), artifact: z.string().optional() }))
});

const base = new URL("./data/", globalThis.location?.href ?? "https://invalid.local/");

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch(new URL("manifest.json", base));
  if (!response.ok) throw new Error("Unable to load report manifest");
  return (await response.json()) as Manifest;
}

export async function loadTests(manifest: Manifest): Promise<TestCase[]> {
  const chunks = await Promise.all(
    manifest.chunks.tests.map(async (chunk) => {
      const response = await fetch(new URL(chunk, base));
      if (!response.ok) throw new Error(`Unable to load ${chunk}`);
      return (await response.json()) as TestCase[];
    })
  );
  return chunks.flat();
}

export async function loadHistory(): Promise<HistoryArtifact | undefined> {
  const historyBase = new URL("./data/", document.baseURI);
  const response = await fetch(new URL("history.json", historyBase));
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Unable to load history (${response.status})`);
  return validateHistoryArtifact(await response.json());
}

export function validateHistoryArtifact(value: unknown): HistoryArtifact {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion !== "1.0"
  )
    throw new Error(`Unsupported history schema version: ${String(value.schemaVersion)}`);
  const parsed = OptimizedHistoryArtifactSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `History artifact does not match the version 1.0 contract at ${issue?.path.join(".") || "root"}: ${issue?.message ?? "validation failed"}`
    );
  }
  return parsed.data as HistoryArtifact;
}
