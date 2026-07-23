export type CanonicalIdentityImplementation = {
  title: string;
  variant?: Record<string, string>;
};

export type CanonicalIdentityGroupAnalysis = {
  canonicalId: string;
  implementationCount: number;
  compatible: boolean;
  conflictReasons: string[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function normalizeLogicalTestTitle(
  title: string,
  canonicalId: string,
  variant?: Record<string, string>
): string {
  let normalized = title.replace(new RegExp(`\\[?${escapeRegExp(canonicalId)}\\]?`, "giu"), " ");
  for (const value of Object.values(variant ?? {}).sort((left, right) => left.localeCompare(right))) {
    const escaped = escapeRegExp(value);
    normalized = normalized
      .replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "giu"), " ")
      .replace(new RegExp(`\\(\\s*${escaped}\\s*\\)`, "giu"), " ");
  }
  return normalized.replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

export function analyzeCanonicalIdentityGroup(
  canonicalId: string,
  implementations: CanonicalIdentityImplementation[]
): CanonicalIdentityGroupAnalysis {
  const logicalTitles = [
    ...new Set(
      implementations.map((implementation) =>
        normalizeLogicalTestTitle(implementation.title, canonicalId, implementation.variant)
      )
    )
  ].sort((left, right) => left.localeCompare(right));
  const compatible = logicalTitles.length <= 1;
  return {
    canonicalId,
    implementationCount: implementations.length,
    compatible,
    conflictReasons: compatible
      ? []
      : [`Canonical ID resolves to different logical titles: ${logicalTitles.join(" | ")}`]
  };
}
