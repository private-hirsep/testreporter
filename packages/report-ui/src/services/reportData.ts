import type { HistoryArtifact, Manifest, TestCase } from "../types";

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
  if (!value || typeof value !== "object") throw new Error("History JSON must be an object");
  const candidate = value as Partial<HistoryArtifact>;
  if (candidate.schemaVersion !== "1.0")
    throw new Error(`Unsupported history schema version: ${String(candidate.schemaVersion)}`);
  if (
    !candidate.project ||
    typeof candidate.project.key !== "string" ||
    !Array.isArray(candidate.runs) ||
    !Array.isArray(candidate.manualExecutions) ||
    !Array.isArray(candidate.cases) ||
    !candidate.trends ||
    !Array.isArray(candidate.diagnostics)
  )
    throw new Error("History artifact does not match the version 1.0 contract");
  return candidate as HistoryArtifact;
}
