import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
  QualityGateConfigSchema,
  QualityReportConfigSchema,
  type QualityGateConfig,
  type QualityReportConfig
} from "@quality-report/report-core";

export const BUILT_IN_QUALITY_PROFILES = {
  strict: {
    tests: { allowFailed: 0, allowBroken: 0, allowSkipped: 0 },
    requirements: { failOnMissing: true, failOnExtra: true },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  },
  default: {},
  relaxed: {
    tests: { allowFailed: 3, allowBroken: 2, allowSkipped: null },
    requirements: { failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: null, maxLow: null },
    warnings: { maxWarnings: null }
  }
} satisfies Record<string, QualityGateConfig>;

export type QualityProfileName = keyof typeof BUILT_IN_QUALITY_PROFILES;

export async function loadQualityGates(path: string): Promise<QualityGateConfig> {
  const content = await readFile(path, "utf8");
  const raw = parseYaml(content) as unknown;
  return QualityGateConfigSchema.parse(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const previous = result[key];
    result[key] = isRecord(previous) && isRecord(value) ? mergeRecords(previous, value) : value;
  }
  return result;
}

export function mergeQualityGates(...configs: QualityGateConfig[]): QualityGateConfig {
  return configs.reduce<QualityGateConfig>((merged, config) => {
    return mergeRecords(
      merged as Record<string, unknown>,
      config as Record<string, unknown>
    ) as QualityGateConfig;
  }, {});
}

export async function loadConfig(
  path: string,
  options: { qualityGatesPath?: string; qualityProfile?: string } = {}
): Promise<QualityReportConfig> {
  const content = await readFile(path, "utf8");
  const raw = parseYaml(content) as unknown;
  const config = QualityReportConfigSchema.parse(raw);
  const profile = options.qualityProfile
    ? (BUILT_IN_QUALITY_PROFILES[options.qualityProfile as QualityProfileName] ?? {})
    : {};
  const external = options.qualityGatesPath ? await loadQualityGates(options.qualityGatesPath) : {};
  return QualityReportConfigSchema.parse({
    ...config,
    qualityGates: mergeQualityGates(config.qualityGates, profile, external)
  });
}
