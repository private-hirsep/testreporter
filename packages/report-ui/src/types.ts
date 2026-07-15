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
  identity?: {
    canonicalId: string;
    technicalId: string;
    source: "explicit" | "title-token" | "mapping" | "generated";
    stable: boolean;
  };
  defects?: string[];
  tags?: string[];
  links?: Array<{
    type: "requirement" | "defect" | "external";
    key?: string;
    label: string;
    url: string;
  }>;
  labels?: Record<string, string[]>;
  error?: { message?: string; trace?: string };
  attachments?: Array<{ name: string; path: string; contentType?: string }>;
  sourcePath?: string;
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
  files: CoverageFile[];
  rawLinks: string[];
};

export type SecurityFinding = {
  id: string;
  tool: string;
  ruleId?: string;
  title: string;
  message?: string;
  severity: string;
  helpUri?: string;
  description?: string;
  precision?: string;
  tags: string[];
  confidence?: string;
  riskCode?: string;
  evidence?: string;
  cweId?: string;
  wascId?: string;
  remediation?: string;
  file?: string;
  line?: number;
  url?: string;
  sourcePath?: string;
};

export type Download = {
  id: string;
  name: string;
  category: string;
  path: string;
  sourcePath?: string;
  sizeBytes?: number;
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
    qualityProfile?: string;
    publishMode?: string;
    prCommentMode?: string;
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
    profile?: string;
    enabled?: boolean;
    checks: Array<{
      id: string;
      label: string;
      status: string;
      actual: string | number;
      expected: string;
      message?: string;
    }>;
  };
  downloads: Download[];
  history: {
    runs: Array<{
      id: string;
      generatedAt: string;
      qualityGateStatus: string;
      testsTotal: number;
      testsFailed: number;
      coveragePercentage?: number;
      requirementCoveragePercentage?: number;
      criticalFindings: number;
      highFindings: number;
    }>;
  };
  warnings: Array<{ code: string; message: string; sourcePath?: string }>;
  identityDiagnostics?: {
    total: number;
    explicit: number;
    titleToken: number;
    mapping: number;
    generated: number;
    duplicateCanonicalIds: string[];
    duplicateExplicitIds: string[];
    malformedExplicitIds: number;
    ambiguousMappings: number;
  };
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
