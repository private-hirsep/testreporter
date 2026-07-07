import type {
  CoverageSummary,
  NormalizedTestCase,
  ParserWarning,
  SecurityFinding,
  TestFramework,
  TestLayer
} from "@quality-report/report-core";

export type ParseContext = {
  sourcePath: string;
  layer?: TestLayer | undefined;
  framework?: TestFramework | undefined;
  requirementPattern: RegExp;
};

export type ParseResult<T> = {
  items: T[];
  warnings: ParserWarning[];
};

export type TestParseResult = ParseResult<NormalizedTestCase>;
export type CoverageParseResult = ParseResult<CoverageSummary>;
export type SecurityParseResult = ParseResult<SecurityFinding>;
