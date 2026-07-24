import type { HistoryArtifact, Manifest, TestCase } from "../types";
import { safeParseOptimizedHistoryArtifact } from "@quality-report/report-core/history-schema";

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
  const parsed = safeParseOptimizedHistoryArtifact(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `History artifact does not match the version 1.0 contract at ${issue?.path.join(".") || "root"}: ${issue?.message ?? "validation failed"}`
    );
  }
  return parsed.data as HistoryArtifact;
}
