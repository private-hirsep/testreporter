export type TestCase = {
  id: string;
  name: string;
  fullName?: string;
  suite?: string;
  file?: string;
  line?: number;
  framework: string;
  layer: string;
  status: string;
  durationMs?: number;
  retries: number;
  requirements: string[];
  error?: { message?: string; trace?: string };
};

export type Manifest = {
  schemaVersion: string;
  metadata: {
    projectName: string;
    repository?: string;
    generatedAt: string;
    branch?: string;
    commitSha?: string;
    runId?: string;
    actor?: string;
  };
  summary: {
    tests: {
      total: number;
      passed: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      byLayer: Record<string, number>;
    };
    coverage: {
      totalPercentage?: number;
      backendPercentage?: number;
      frontendPercentage?: number;
    };
    security: Record<string, number>;
    requirements: RequirementCoverage;
  };
  requirements: RequirementCoverage;
  coverage: Array<Record<string, unknown>>;
  security: Array<Record<string, unknown>>;
  qualityGate: {
    status: string;
    checks: Array<{ id: string; label: string; status: string; actual: string | number; expected: string }>;
  };
  downloads: Array<{ id: string; name: string; category: string; path: string; sizeBytes?: number }>;
  warnings: Array<{ code: string; message: string; sourcePath?: string }>;
  chunks: { tests: string[] };
};

export type RequirementCoverage = {
  expected: string[];
  covered: string[];
  missing: string[];
  extra: string[];
  percentage: number;
  testsByRequirement: Record<string, string[]>;
};
