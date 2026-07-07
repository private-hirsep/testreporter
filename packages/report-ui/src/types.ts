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

export type CoverageMetric = {
  covered?: number;
  missed?: number;
  total?: number;
  percentage?: number;
};

export type CoverageFile = {
  path: string;
  packageName?: string;
  statements?: CoverageMetric;
  instructions?: CoverageMetric;
  branches?: CoverageMetric;
  lines?: CoverageMetric;
  functions?: CoverageMetric;
  methods?: CoverageMetric;
};

export type CoverageSummary = {
  layer: string;
  statements?: CoverageMetric;
  instructions?: CoverageMetric;
  branches?: CoverageMetric;
  lines?: CoverageMetric;
  functions?: CoverageMetric;
  methods?: CoverageMetric;
  files?: CoverageFile[];
  rawLinks?: string[];
};

export type SecurityFinding = {
  id: string;
  tool?: string;
  ruleId?: string;
  title?: string;
  message?: string;
  severity?: string;
  confidence?: string;
  riskCode?: string;
  evidence?: string;
  cwe?: string | string[];
  wasc?: string | string[];
  file?: string;
  line?: number;
  url?: string;
  remediation?: string;
  help?: string;
  helpUri?: string;
  sourcePath?: string;
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
  coverage: CoverageSummary[];
  security: SecurityFinding[];
  qualityGate: {
    status: string;
    checks: Array<{ id: string; label: string; status: string; actual: string | number; expected: string; message?: string }>;
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
