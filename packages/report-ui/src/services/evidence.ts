import type { Download, Manifest } from "../types";

export type EvidenceGroup = {
  category: string;
  label: string;
  description: string;
  items: Download[];
};

const GROUPS: Array<{ category: string; label: string; description: string }> = [
  {
    category: "report",
    label: "Audit package",
    description: "The complete generated report bundle for archival"
  },
  {
    category: "tests",
    label: "Raw test reports",
    description: "Original automated test result artifacts as parsed"
  },
  {
    category: "manual",
    label: "Manual testing",
    description: "Manual case definitions, imported results, and evidence files"
  },
  {
    category: "requirements",
    label: "Requirement traceability",
    description: "Expected requirement sets, mappings, and release scope"
  },
  {
    category: "coverage",
    label: "Coverage artifacts",
    description: "Raw coverage reports backing the coverage metrics"
  },
  {
    category: "security",
    label: "Security artifacts",
    description: "Raw scanner output backing the security findings"
  },
  {
    category: "raw",
    label: "Other raw artifacts",
    description: "Additional artifacts included with this report"
  }
];

export function groupEvidence(manifest: Manifest): EvidenceGroup[] {
  const known = new Set(GROUPS.map((group) => group.category));
  const groups = GROUPS.map((group) => ({
    ...group,
    items: manifest.downloads.filter((download) => download.category === group.category)
  }));
  const leftover = manifest.downloads.filter((download) => !known.has(download.category));
  if (leftover.length) {
    groups.push({
      category: "other",
      label: "Uncategorized",
      description: "Artifacts without a known category",
      items: leftover
    });
  }
  return groups.filter((group) => group.items.length > 0);
}

export type AuditFileStatus = {
  path: string;
  label: string;
  description: string;
  available?: boolean;
};

/** Static integrity files written next to the report; availability is probed at runtime. */
export const auditFiles: AuditFileStatus[] = [
  {
    path: "evidence-manifest.json",
    label: "Evidence manifest",
    description: "Machine-readable list of every included file with SHA-256 checksums"
  },
  {
    path: "checksums.sha256",
    label: "Checksums",
    description: "Plain checksum list for offline integrity verification"
  }
];
