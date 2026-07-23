import type { HistoryArtifact, Manifest, TestCase } from "../types";

const base = new URL("./data/", window.location.href);

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
  const base = new URL("./data/", document.baseURI);
  const response = await fetch(new URL("history.json", base));
  if (response.status === 404) return undefined;
  if (!response.ok) return undefined;
  return (await response.json()) as HistoryArtifact;
}
