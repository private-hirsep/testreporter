import { z } from "zod";

import { ManualCaseSchema, ManualExecutionSchema } from "./manual.js";
import { ReadinessSchema, ReleaseScopeSchema } from "../release/readiness.js";
import {
  TestCaseCatalogueEntrySchema,
  UnifiedExecutionSchema
} from "../catalogue/derive.js";

export const TestStatusSchema = z.enum(["passed", "failed", "broken", "skipped", "unknown"]);
export const TestLayerSchema = z.enum(["backend", "frontend", "e2e", "unknown"]);
export const TestFrameworkSchema = z.enum(["junit", "pytest", "vitest", "playwright", "unknown"]);
export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info", "unknown"]);
export const GateStatusSchema = z.enum(["passed", "failed", "skipped", "not_evaluated"]);

export const NormalizedAttachmentSchema = z.object({
  name: z.string(),
  path: z.string(),
  contentType: z.string().optional()
});

export const TestIdentitySchema = z.object({
  canonicalId: z.string(),
  technicalId: z.string(),
  source: z.enum(["explicit", "title-token", "mapping", "generated"]),
  stable: z.boolean()
});

export const TraceabilityLinkSchema = z.object({
  type: z.enum(["requirement", "defect", "external"]),
  key: z.string().optional(),
  label: z.string(),
  url: z.string().url()
});

export const NormalizedTestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string().optional(),
  suite: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  framework: TestFrameworkSchema,
  layer: TestLayerSchema,
  status: TestStatusSchema,
  durationMs: z.number().nonnegative().optional(),
  retries: z.number().int().nonnegative().default(0),
  requirements: z.array(z.string()).default([]),
  identity: TestIdentitySchema.optional(),
  defects: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  links: z.array(TraceabilityLinkSchema).default([]),
  labels: z.record(z.array(z.string())).default({}),
  error: z
    .object({
      message: z.string().optional(),
      trace: z.string().optional()
    })
    .optional(),
  attachments: z.array(NormalizedAttachmentSchema).default([]),
  sourcePath: z.string().optional(),
  definitionHistory: z.object({
    confidence: z.enum(["exact-id", "source-range", "file-level", "unavailable"]),
    sourcePath: z.string().optional(),
    earliest: z.object({ hash: z.string(), author: z.string(), date: z.string(), message: z.string(), url: z.string().url().optional() }).optional(),
    latest: z.object({ hash: z.string(), author: z.string(), date: z.string(), message: z.string(), url: z.string().url().optional() }).optional(),
    revisions: z.array(z.object({ hash: z.string(), author: z.string(), date: z.string(), message: z.string(), url: z.string().url().optional() })).default([])
  }).optional()
});

export const CoverageMetricSchema = z.object({
  covered: z.number().nonnegative().optional(),
  missed: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional()
});

export const CoverageSummarySchema = z.object({
  layer: TestLayerSchema,
  statements: CoverageMetricSchema.optional(),
  instructions: CoverageMetricSchema.optional(),
  branches: CoverageMetricSchema.optional(),
  lines: CoverageMetricSchema.optional(),
  functions: CoverageMetricSchema.optional(),
  methods: CoverageMetricSchema.optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        packageName: z.string().optional(),
        statements: CoverageMetricSchema.optional(),
        instructions: CoverageMetricSchema.optional(),
        branches: CoverageMetricSchema.optional(),
        lines: CoverageMetricSchema.optional(),
        functions: CoverageMetricSchema.optional(),
        methods: CoverageMetricSchema.optional()
      })
    )
    .default([]),
  rawLinks: z.array(z.string()).default([])
});

export const RequirementCoverageSchema = z.object({
  expected: z.array(z.string()).default([]),
  covered: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  extra: z.array(z.string()).default([]),
  percentage: z.number().min(0).max(100),
  testsByRequirement: z.record(z.array(z.string())).default({})
  ,manualCasesByRequirement: z.record(z.array(z.string())).default({}),
  latestManualResultByRequirement: z.record(z.enum(["not-run", "passed", "failed", "blocked", "skipped"])).default({}),
  evidenceTypeByRequirement: z.record(z.enum(["automated", "manual-defined", "manual-executed", "both"])).default({})
});

export const SecurityFindingSchema = z.object({
  id: z.string(),
  tool: z.enum(["codeql", "sarif", "zap", "unknown"]),
  ruleId: z.string().optional(),
  title: z.string(),
  message: z.string().optional(),
  severity: SeveritySchema,
  helpUri: z.string().optional(),
  description: z.string().optional(),
  precision: z.string().optional(),
  tags: z.array(z.string()).default([]),
  confidence: z.string().optional(),
  riskCode: z.string().optional(),
  evidence: z.string().optional(),
  cweId: z.string().optional(),
  wascId: z.string().optional(),
  remediation: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  url: z.string().optional(),
  sourcePath: z.string().optional()
});

export const DownloadableArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["tests", "coverage", "security", "requirements", "manual", "raw", "report"]),
  path: z.string(),
  sourcePath: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional()
});

export const ParserWarningSchema = z.object({
  sourcePath: z.string().optional(),
  code: z.string(),
  message: z.string()
});

export const RunMetadataSchema = z.object({
  projectKey: z.string().optional(),
  projectName: z.string(),
  repository: z.string().optional(),
  generatedAt: z.string(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  runId: z.string().optional(),
  release: z.string().optional(),
  testedBuild: z.string().optional(),
  environment: z.string().optional(),
  workflowRun: z.string().optional(),
  releaseDate: z.string().optional(),
  actor: z.string().optional(),
  qualityProfile: z.string().optional(),
  publishMode: z.string().optional(),
  prCommentMode: z.string().optional()
});

export const QualityGateCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: GateStatusSchema,
  actual: z.union([z.string(), z.number()]),
  expected: z.string(),
  message: z.string().optional()
});

export const QualityGateResultSchema = z.object({
  status: GateStatusSchema,
  profile: z.string().optional(),
  enabled: z.boolean().default(true),
  checks: z.array(QualityGateCheckSchema)
});

export const HistoryRunSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  qualityGateStatus: GateStatusSchema,
  testsTotal: z.number().int().nonnegative(),
  testsFailed: z.number().int().nonnegative(),
  coveragePercentage: z.number().min(0).max(100).optional(),
  requirementCoveragePercentage: z.number().min(0).max(100).optional(),
  criticalFindings: z.number().int().nonnegative(),
  highFindings: z.number().int().nonnegative()
});

export const ReportSummarySchema = z.object({
  tests: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    broken: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
    byLayer: z.record(z.number().int().nonnegative())
  }),
  coverage: z.object({
    totalPercentage: z.number().min(0).max(100).optional(),
    backendPercentage: z.number().min(0).max(100).optional(),
    frontendPercentage: z.number().min(0).max(100).optional()
  }),
  security: z.record(z.number().int().nonnegative()),
  requirements: RequirementCoverageSchema,
  manual: z
    .object({
      cases: z.number().int().nonnegative(),
      executed: z.number().int().nonnegative(),
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      notRun: z.number().int().nonnegative(),
      completionPercentage: z.number().min(0).max(100),
      missingEvidence: z.number().int().nonnegative()
    })
    .default({
      cases: 0,
      executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      notRun: 0,
      completionPercentage: 100,
      missingEvidence: 0
    })
});

export const IdentityDiagnosticsSchema = z.object({
  total: z.number().int().nonnegative(),
  explicit: z.number().int().nonnegative(),
  titleToken: z.number().int().nonnegative(),
  mapping: z.number().int().nonnegative(),
  generated: z.number().int().nonnegative(),
  duplicateCanonicalIds: z.array(z.string()).default([]),
  duplicateExplicitIds: z.array(z.string()).default([]),
  malformedExplicitIds: z.number().int().nonnegative().default(0),
  ambiguousMappings: z.number().int().nonnegative().default(0)
});

export const NormalizedReportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  metadata: RunMetadataSchema,
  summary: ReportSummarySchema,
  tests: z.array(NormalizedTestCaseSchema),
  coverage: z.array(CoverageSummarySchema),
  requirements: RequirementCoverageSchema,
  security: z.array(SecurityFindingSchema),
  qualityGate: QualityGateResultSchema,
  downloads: z.array(DownloadableArtifactSchema),
  history: z.object({ runs: z.array(HistoryRunSchema).default([]) }).default({ runs: [] }),
  warnings: z.array(ParserWarningSchema),
  manualCases: z.array(ManualCaseSchema).default([]),
  manualExecutions: z.array(ManualExecutionSchema).default([]),
  releaseScope: ReleaseScopeSchema.optional(),
  readiness: ReadinessSchema.optional(),
  git: z.object({ available: z.boolean(), shallow: z.boolean().default(false), commit: z.string().optional(), branch: z.string().optional(), tags: z.array(z.string()).default([]), dirty: z.boolean().optional(), author: z.string().optional(), timestamp: z.string().optional(), message: z.string().optional(), warning: z.string().optional() }).optional(),
  identityDiagnostics: IdentityDiagnosticsSchema.default({
    total: 0,
    explicit: 0,
    titleToken: 0,
    mapping: 0,
    generated: 0,
    duplicateCanonicalIds: [],
    duplicateExplicitIds: [],
    malformedExplicitIds: 0,
    ambiguousMappings: 0
  }),
  testCaseCatalogue: z.array(TestCaseCatalogueEntrySchema).optional(),
  unifiedExecutions: z.array(UnifiedExecutionSchema).optional()
});

export type TestStatus = z.infer<typeof TestStatusSchema>;
export type TestLayer = z.infer<typeof TestLayerSchema>;
export type TestFramework = z.infer<typeof TestFrameworkSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type NormalizedTestCase = z.infer<typeof NormalizedTestCaseSchema>;
export type TestIdentity = z.infer<typeof TestIdentitySchema>;
export type IdentityDiagnostics = z.infer<typeof IdentityDiagnosticsSchema>;
export type CoverageMetric = z.infer<typeof CoverageMetricSchema>;
export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;
export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;
export type DownloadableArtifact = z.infer<typeof DownloadableArtifactSchema>;
export type ParserWarning = z.infer<typeof ParserWarningSchema>;
export type RunMetadata = z.infer<typeof RunMetadataSchema>;
export type ReportMetadata = RunMetadata;
export type QualityGateCheck = z.infer<typeof QualityGateCheckSchema>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
export type HistoryRun = z.infer<typeof HistoryRunSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type NormalizedReport = z.infer<typeof NormalizedReportSchema>;
