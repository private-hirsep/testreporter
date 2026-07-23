import type { Manifest } from "../types";
import { shortSha } from "../format";
import { resolveStatus, type StatusDescriptor } from "./status";

export type ProjectContext = {
  projectName: string;
  /** Pipe-separated identity line: release, branch, environment. */
  identityParts: string[];
  /** Dot-separated provenance line: last tested, commit, workflow run. */
  provenanceParts: string[];
  overallStatus: StatusDescriptor;
  overallStatusSource: "readiness" | "quality-gate" | "unavailable";
};

export function formatContextDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function overallStatus(manifest?: Manifest): {
  descriptor: StatusDescriptor;
  source: ProjectContext["overallStatusSource"];
} {
  if (manifest?.readiness) {
    return { descriptor: resolveStatus(manifest.readiness.status), source: "readiness" };
  }
  const gate = manifest?.qualityGate;
  if (gate && gate.status !== "skipped" && gate.enabled !== false) {
    const descriptor = resolveStatus(gate.status);
    return {
      descriptor: { ...descriptor, label: `Quality gate ${descriptor.label.toLowerCase()}` },
      source: "quality-gate"
    };
  }
  return { descriptor: resolveStatus("unavailable"), source: "unavailable" };
}

export function buildProjectContext(manifest?: Manifest): ProjectContext {
  const metadata = manifest?.metadata;
  const identityParts: string[] = [];
  if (metadata?.release) identityParts.push(`Release ${metadata.release}`);
  if (metadata?.branch) identityParts.push(metadata.branch);
  if (metadata?.environment) identityParts.push(metadata.environment);

  const provenanceParts: string[] = [];
  const tested = formatContextDate(metadata?.generatedAt);
  if (tested) provenanceParts.push(`Last tested ${tested}`);
  if (metadata?.testedBuild) provenanceParts.push(`build ${metadata.testedBuild}`);
  if (metadata?.commitSha) provenanceParts.push(`commit ${shortSha(metadata.commitSha)}`);
  const run = metadata?.workflowRun ?? metadata?.runId;
  if (run) provenanceParts.push(`workflow ${run}`);

  const status = overallStatus(manifest);
  return {
    projectName: metadata?.projectName ?? "Quality Report",
    identityParts,
    provenanceParts,
    overallStatus: status.descriptor,
    overallStatusSource: status.source
  };
}
