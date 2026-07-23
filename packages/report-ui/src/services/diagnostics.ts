import type { Manifest } from "../types";

export type DiagnosticWarning = { code: string; message: string; sourcePath?: string };

export type DiagnosticCategory = {
  id: string;
  label: string;
  description: string;
  warnings: DiagnosticWarning[];
};

const CATEGORIES: Array<{
  id: string;
  label: string;
  description: string;
  matches: (code: string) => boolean;
}> = [
  {
    id: "identity",
    label: "Test identity",
    description: "Canonical ID resolution and stability problems",
    matches: (code) => code.includes("identity") || code.includes("duplicate-id")
  },
  {
    id: "mapping",
    label: "Mapping",
    description: "Test, requirement, or defect mapping problems",
    matches: (code) => code.includes("mapping")
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Configuration and release scope problems",
    matches: (code) =>
      code.startsWith("config") || code.startsWith("release-scope") || code.includes("profile")
  },
  {
    id: "git",
    label: "Git history",
    description: "Problems collecting Git-based definition history",
    matches: (code) => code.startsWith("git")
  },
  {
    id: "evidence",
    label: "Missing evidence",
    description: "Declared evidence that could not be found",
    matches: (code) => code.includes("evidence") || code.includes("attachment")
  },
  {
    id: "compatibility",
    label: "Data compatibility",
    description: "Artifacts that could not be parsed or were partially read",
    matches: () => true
  }
];

export function groupWarnings(warnings: DiagnosticWarning[]): DiagnosticCategory[] {
  const grouped = CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    description: category.description,
    warnings: [] as DiagnosticWarning[]
  }));
  for (const warning of warnings) {
    const index = CATEGORIES.findIndex((category) => category.matches(warning.code));
    grouped[index === -1 ? grouped.length - 1 : index]!.warnings.push(warning);
  }
  return grouped.filter((category) => category.warnings.length > 0);
}

export type IdentityIssue = { label: string; value: string; severity: "warning" | "info" };

export function identityIssues(manifest: Manifest): IdentityIssue[] {
  const diagnostics = manifest.identityDiagnostics;
  if (!diagnostics) return [];
  const issues: IdentityIssue[] = [];
  const conflictingIds =
    diagnostics.conflictingCanonicalIds ?? diagnostics.duplicateCanonicalIds;
  const conflictingSet = new Set(conflictingIds);
  const compatibleIds = (diagnostics.multiImplementationCanonicalIds ?? []).filter(
    (canonicalId) => !conflictingSet.has(canonicalId)
  );
  if (conflictingIds.length)
    issues.push({
      label: "Conflicting canonical IDs",
      value: [...conflictingIds].sort((left, right) => left.localeCompare(right)).join(", "),
      severity: "warning"
    });
  if (diagnostics.duplicateExplicitIds.length)
    issues.push({
      label: "Duplicate explicit IDs",
      value: diagnostics.duplicateExplicitIds.join(", "),
      severity: "warning"
    });
  if (compatibleIds.length)
    issues.push({
      label: "Compatible multi-implementation IDs",
      value: [...compatibleIds].sort((left, right) => left.localeCompare(right)).join(", "),
      severity: "info"
    });
  if (diagnostics.malformedExplicitIds)
    issues.push({
      label: "Malformed explicit metadata",
      value: String(diagnostics.malformedExplicitIds),
      severity: "warning"
    });
  if (diagnostics.ambiguousMappings)
    issues.push({
      label: "Ambiguous mappings",
      value: String(diagnostics.ambiguousMappings),
      severity: "warning"
    });
  return issues;
}
