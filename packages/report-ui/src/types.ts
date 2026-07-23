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
  definitionHistory?: {
    confidence: "exact-id" | "source-range" | "file-level" | "unavailable";
    sourcePath?: string;
    earliest?: DefinitionRevision;
    latest?: DefinitionRevision;
    revisions: DefinitionRevision[];
  };
};
export type DefinitionRevision = {
  hash: string;
  author: string;
  date: string;
  message: string;
  url?: string;
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
    projectKey?: string;
    release?: string;
    testedBuild?: string;
    environment?: string;
    workflowRun?: string;
    releaseDate?: string;
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
  manualCases: ManualCase[];
  manualExecutions: ManualExecution[];
  readiness?: {
    status: "ready" | "ready-with-accepted-risks" | "warning" | "blocked" | "incomplete";
    reasons: string[];
    automated: { passed: number; failed: number; skipped: number; missing: boolean };
    manual: { passed: number; failed: number; blocked: number; notRun: number };
    requirements: {
      covered: number;
      uncovered: number;
      excluded: number;
      uncoveredIds: string[];
      excludedIds: string[];
    };
    securityBlockers: number;
    qualityGateFailed: boolean;
    acceptedRisks: Array<{ id: string; reason: string; reference?: string }>;
    missingEvidence: string[];
    actions: Array<{
      severity: string;
      type: string;
      project: string;
      reference?: string;
      message: string;
      href?: string;
    }>;
  };
};

export type RequirementCoverage = {
  expected: string[];
  covered: string[];
  missing: string[];
  extra: string[];
  percentage: number;
  testsByRequirement: Record<string, string[]>;
  manualCasesByRequirement?: Record<string, string[]>;
  latestManualResultByRequirement?: Record<string, ManualStatus>;
  evidenceTypeByRequirement?: Record<
    string,
    "automated" | "manual-defined" | "manual-executed" | "both"
  >;
};

export type ManualStatus = "not-run" | "passed" | "failed" | "blocked" | "skipped";
export type ManualCase = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  risk: string;
  requirements: string[];
  tags: string[];
  owner?: string;
  estimatedMinutes?: number;
  preconditions: string[];
  steps: Array<{ action: string; expected: string }>;
  sourcePath?: string;
  revision?: string;
  definitionHistory?: {
    confidence: "exact-id" | "source-range" | "file-level" | "unavailable";
    sourcePath?: string;
    earliest?: DefinitionRevision;
    latest?: DefinitionRevision;
    revisions: DefinitionRevision[];
  };
};
export type ManualExecution = {
  schemaVersion: "1.0";
  executionId: string;
  projectKey: string;
  release?: string;
  testedBuild: string;
  environment: string;
  tester: string;
  startedAt: string;
  completedAt?: string;
  sourceCommit?: string;
  state: "draft" | "completed";
  cases: Array<{
    caseId: string;
    caseRevision?: string;
    status: ManualStatus;
    steps: Array<{
      index: number;
      status: ManualStatus;
      actualResult?: string;
      notes?: string;
      evidence: string[];
    }>;
    actualResult?: string;
    notes?: string;
    defects: string[];
    evidence: string[];
  }>;
};
