import { z } from "zod";

export const TestStatusSchema = z.enum(["passed", "failed", "broken", "skipped", "unknown"]);
export const TestLayerSchema = z.enum(["backend", "frontend", "e2e", "unknown"]);
export const TestFrameworkSchema = z.enum([
  "junit",
  "pytest",
  "vitest",
  "playwright",
  "unknown"
]);
export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info", "unknown"]);
export const GateStatusSchema = z.enum(["passed", "failed", "warning", "unknown"]);

export const NormalizedAttachmentSchema = z.object({
  name: z.string(),
  path: z.string(),
  contentType: z.string().optional()
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
  labels: z.record(z.array(z.string())).default({}),
  error: z
    .object({
      message: z.string().optional(),
      trace: z.string().optional()
    })
    .optional(),
  attachments: z.array(NormalizedAttachmentSchema).default([]),
  sourcePath: z.string().optional()
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
});

export const SecurityFindingSchema = z.object({
  id: z.string(),
  tool: z.enum(["codeql", "sarif", "zap", "unknown"]),
  ruleId: z.string().optional(),
  title: z.string(),
  message: z.string().optional(),
  severity: SeveritySchema,
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  url: z.string().optional(),
  sourcePath: z.string().optional()
});

export const DownloadableArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["tests", "coverage", "security", "requirements", "raw", "report"]),
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
  projectName: z.string(),
  repository: z.string().optional(),
  generatedAt: z.string(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  runId: z.string().optional(),
  actor: z.string().optional()
});

export const QualityGateResultSchema = z.object({
  status: GateStatusSchema,
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: GateStatusSchema,
      actual: z.union([z.string(), z.number()]),
      expected: z.string(),
      message: z.string().optional()
    })
  )
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
  requirements: RequirementCoverageSchema
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
  warnings: z.array(ParserWarningSchema)
});

export type TestStatus = z.infer<typeof TestStatusSchema>;
export type TestLayer = z.infer<typeof TestLayerSchema>;
export type TestFramework = z.infer<typeof TestFrameworkSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type NormalizedTestCase = z.infer<typeof NormalizedTestCaseSchema>;
export type CoverageMetric = z.infer<typeof CoverageMetricSchema>;
export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;
export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;
export type DownloadableArtifact = z.infer<typeof DownloadableArtifactSchema>;
export type ParserWarning = z.infer<typeof ParserWarningSchema>;
export type RunMetadata = z.infer<typeof RunMetadataSchema>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
export type HistoryRun = z.infer<typeof HistoryRunSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type NormalizedReport = z.infer<typeof NormalizedReportSchema>;
