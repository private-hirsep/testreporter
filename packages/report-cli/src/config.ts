import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
  QualityGateConfigSchema,
  QualityReportConfigSchema,
  type QualityGateConfig,
  type QualityReportConfig
} from "@quality-report/report-core";
import { z } from "zod";

const ExternalQualityGatesSchema = z
  .object({
    qualityGates: QualityReportConfigSchema.shape.qualityGates.optional(),
    qualityGateProfiles: QualityReportConfigSchema.shape.qualityGateProfiles.optional()
  })
  .strict();

export const BUILT_IN_QUALITY_PROFILES: Record<string, QualityGateConfig> = {
  off: {
    tests: { allowFailed: 999999, allowBroken: 999999 },
    coverage: {},
    requirements: { failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 999999, maxHigh: 999999, maxMedium: 999999 },
    warnings: { maxWarnings: 999999 }
  },
  relaxed: {
    tests: { allowFailed: 3, allowBroken: 2 },
    coverage: { totalMinimum: 60 },
    requirements: { minimum: 60, failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 5, maxMedium: 10 },
    warnings: { maxWarnings: 20 }
  },
  standard: {
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 70 },
    requirements: { minimum: 75, failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 3 },
    warnings: { maxWarnings: 10 }
  },
  strict: {
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 85, backendMinimum: 85, frontendMinimum: 80 },
    requirements: { minimum: 90, failOnMissing: true, failOnExtra: true },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  },
  release: {
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 90, backendMinimum: 90, frontendMinimum: 85 },
    requirements: { minimum: 100, failOnMissing: true, failOnExtra: true },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  }
};

export type QualityProfileName = string;

export function availableProfiles(config: QualityReportConfig): string[] {
  return [...Object.keys(BUILT_IN_QUALITY_PROFILES), ...Object.keys(config.qualityGateProfiles)];
}

export function applyQualityProfile(
  config: QualityReportConfig,
  profile: QualityProfileName
): QualityReportConfig {
  if (!profile) return config;
  const gates = config.qualityGateProfiles[profile] ?? BUILT_IN_QUALITY_PROFILES[profile];
  if (!gates) {
    throw new Error(
      `Unknown quality profile "${profile}". Available profiles: ${availableProfiles(config).join(", ")}`
    );
  }
  return { ...config, qualityGates: QualityGateConfigSchema.parse(gates) };
}

async function loadExternalQualityGates(
  config: QualityReportConfig,
  path?: string
): Promise<QualityReportConfig> {
  if (!path) return config;
  const content = await readFile(path, "utf8");
  const raw = parseYaml(content) as unknown;
  const wrapped = ExternalQualityGatesSchema.safeParse(raw);
  const external = wrapped.success
    ? wrapped.data
    : { qualityGates: QualityGateConfigSchema.parse(raw) };
  return {
    ...config,
    ...(external.qualityGates
      ? { qualityGates: QualityGateConfigSchema.parse(external.qualityGates) }
      : {}),
    qualityGateProfiles: {
      ...config.qualityGateProfiles,
      ...(external.qualityGateProfiles ?? {})
    }
  };
}

export async function loadConfig(
  path: string,
  profileOrOptions?: string | { qualityProfile?: string; qualityGatesPath?: string },
  qualityGatesPath?: string
): Promise<QualityReportConfig> {
  const content = await readFile(path, "utf8");
  const raw = parseYaml(content) as unknown;
  const profile =
    typeof profileOrOptions === "string" ? profileOrOptions : profileOrOptions?.qualityProfile;
  const externalPath =
    typeof profileOrOptions === "string" ? qualityGatesPath : profileOrOptions?.qualityGatesPath;
  const config = await loadExternalQualityGates(QualityReportConfigSchema.parse(raw), externalPath);
  return profile ? applyQualityProfile(config, profile) : config;
}
