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
  executedAt?: string;
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
  variant?: Record<string, string>;
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
    multiImplementationCanonicalIds?: string[];
    conflictingCanonicalIds?: string[];
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
  testCaseCatalogue?: TestCaseCatalogueEntry[];
  unifiedExecutions?: UnifiedExecution[];
};

export type CatalogueStatus =
  | "broken"
  | "failed"
  | "blocked"
  | "not-run"
  | "skipped"
  | "passed"
  | "unknown";

export type TestCaseImplementation = {
  technicalId: string;
  kind: "automated" | "manual";
  title: string;
  framework?: string;
  layer?: string;
  source?: { file?: string; line?: number };
  suitePath?: string[];
  variant?: Record<string, string>;
  requirements: string[];
  defects: string[];
  tags: string[];
  active: boolean;
  latestResult?: {
    status: CatalogueStatus;
    executedAt?: string;
    durationMs?: number;
    executionId?: string;
  };
};

export type TestCaseCatalogueEntry = {
  id: string;
  canonicalId: string;
  displayId: string;
  identity: {
    source: "explicit" | "title-token" | "mapping" | "generated";
    stable: boolean;
    conflict: boolean;
  };
  title: string;
  type: "automated" | "manual" | "hybrid";
  lifecycleStatus?: "draft" | "approved" | "deprecated";
  requirements: string[];
  defects: string[];
  tags: string[];
  implementations: TestCaseImplementation[];
  latestResult?: {
    status: CatalogueStatus;
    executedAt?: string;
    durationMs?: number;
    executionId?: string;
    contributingStatuses: CatalogueStatus[];
  };
  lastExecutedAt?: string;
  stability: {
    available: boolean;
    sampleSize: number;
    passed: number;
    failed: number;
    flaky: number;
    passRate?: number;
    source: "current-report" | "available-history" | "insufficient-data";
    unavailableReason?: "identity-conflict";
  };
  duration?: {
    sampleSize: number;
    latestMs?: number;
    averageMs?: number;
    medianMs?: number;
    minMs?: number;
    maxMs?: number;
    source: "automated" | "manual" | "mixed";
  };
  definitionHistory?: TestCase["definitionHistory"][];
  evidence?: { attachmentCount: number; references: string[] };
};

export type UnifiedExecution = {
  id: string;
  type: "automated" | "manual";
  project: string;
  release?: string;
  branch?: string;
  environment?: string;
  commit?: string;
  workflowRun?: string;
  workflowAttempt?: number;
  startedAt?: string;
  completedAt?: string;
  reportedAt?: string;
  status: "passed" | "failed" | "blocked" | "incomplete" | "unknown";
  counts: {
    total: number;
    passed: number;
    failed: number;
    broken?: number;
    blocked?: number;
    skipped?: number;
    notRun?: number;
    unknown?: number;
  };
  durationMs?: number;
  testDurationSumMs?: number;
  testCaseIds: string[];
  caseResults: Array<{
    testCaseId: string;
    implementationId?: string;
    status: CatalogueStatus;
    durationMs?: number;
    evidenceCount?: number;
    evidenceReferences?: string[];
    defects?: string[];
    notes?: string[];
    attempt?: number;
  }>;
  requirementIds: string[];
  defectIds: string[];
  evidence?: { complete: boolean; referenceCount: number };
  tester?: string;
  testedBuild?: string;
  notes?: string[];
  sourceReport?: string;
  caseResultsAvailable?: boolean;
};

export type HistoryArtifact = {
  schemaVersion: string;
  project: { key: string; name: string };
  generatedAt: string;
  retention: {
    maxRuns: number;
    maxAgeDays: number;
    maxManualExecutions: number;
    prunedRuns: number;
    prunedManualExecutions: number;
  };
  availability: "unavailable" | "insufficient" | "available";
  runs: Array<{
    id: string;
    type: "automated";
    projectKey: string;
    release?: string;
    branch?: string;
    environment?: string;
    commit?: string;
    workflowRun?: string;
    workflowAttempt?: number;
    reportedAt: string;
    startedAt?: string;
    completedAt?: string;
    wallClockDurationMs?: number;
    testDurationSumMs?: number;
    status: "passed" | "failed" | "blocked" | "incomplete" | "unknown";
    counts: UnifiedExecution["counts"];
    qualityGate?: { status: string; profile?: string };
    readiness?: { status: string; blockers: number; warnings: number; acceptedRisks: number };
    requirements?: { covered: number; uncovered: number; excluded: number; total: number };
    coverage?: { line?: number; branch?: number; function?: number; statement?: number };
    security?: { blockers: number; warnings: number; accepted: number };
    caseResults: Array<{
      testCaseId: string;
      implementationId?: string;
      status: CatalogueStatus;
      durationMs?: number;
      attemptCount?: number;
      flakyInRun?: boolean;
      identity: { source: string; stable: boolean; conflict: boolean };
    }>;
    sourceReport?: { url?: string; evidenceUrl?: string };
  }>;
  manualExecutions: Array<{
    executionId: string;
    projectKey: string;
    release?: string;
    environment?: string;
    testedBuild?: string;
    tester?: string;
    startedAt: string;
    completedAt: string;
    status: "passed" | "failed" | "blocked" | "incomplete" | "unknown";
    caseResults: Array<{ testCaseId: string; status: CatalogueStatus }>;
    sourceReport?: { url?: string; evidenceUrl?: string };
  }>;
  cases: HistoricalCaseSummary[];
  trends: {
    runCount: number;
    oldestAt?: string;
    newestAt?: string;
    newFailures: number;
    persistentFailures: number;
    recovered: number;
    removedOrMissing: number;
    unstable: number;
    slowRegressions: number;
  };
  diagnostics: Array<{ severity: string; code: string; message: string; artifact?: string }>;
};

export type HistoricalCaseSummary = {
  testCaseId: string;
  samples: Array<{
    executionId: string;
    type: "automated" | "manual";
    at: string;
    status: string;
    presence: "present" | "absent";
    branch?: string;
    environment?: string;
    release?: string;
    commit?: string;
    durationMs?: number;
    implementationResults?: HistoryArtifact["runs"][number]["caseResults"];
    sourceReport?: { url?: string; evidenceUrl?: string };
  }>;
  currentStatus?: string;
  previousStatus?: string;
  transition: string;
  sampleSize: number;
  passed: number;
  failed: number;
  passRate?: number;
  consecutiveFailures: number;
  lastPassedAt?: string;
  lastFailedAt?: string;
  identityConfidence: "trusted" | "generated-low" | "conflicted";
  stability: string;
  passFailTransitions: number;
  duration?: {
    latestMs: number;
    medianMs: number;
    previousMs?: number;
    absoluteChangeMs?: number;
    percentageChange?: number;
    recentMedianMs: number;
    slowRegression: boolean;
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
