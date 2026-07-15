import { parse as parseYaml } from "yaml";
import {
  ManualCaseSchema,
  ManualExecutionSchema,
  type ManualCase,
  type ManualExecution
} from "@quality-report/report-core";
import type { ParseResult } from "./types.js";

function failure(sourcePath: string, code: string, error: unknown): ParseResult<never> {
  return {
    items: [],
    warnings: [
      {
        sourcePath,
        code,
        message: error instanceof Error ? error.message : "Invalid manual artifact"
      }
    ]
  };
}
export function parseManualCase(content: string, sourcePath: string): ParseResult<ManualCase> {
  try {
    return { items: [{ ...ManualCaseSchema.parse(parseYaml(content)), sourcePath }], warnings: [] };
  } catch (error) {
    return failure(sourcePath, "manual.case.invalid", error);
  }
}
export function parseManualExecution(
  content: string,
  sourcePath: string
): ParseResult<ManualExecution> {
  try {
    return { items: [ManualExecutionSchema.parse(JSON.parse(content))], warnings: [] };
  } catch (error) {
    return failure(sourcePath, "manual.execution.invalid", error);
  }
}
