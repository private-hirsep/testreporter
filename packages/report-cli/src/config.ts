import { access, readFile } from "node:fs/promises";
import { parse as parseYaml, YAMLParseError } from "yaml";
import {
  CustomQualityGateFileSchema,
  QualityReportConfigSchema,
  resolveQualityProfile,
  type CustomQualityGateFile,
  type QualityReportConfig
} from "@quality-report/report-core";

const DEFAULT_QUALITY_GATES = QualityReportConfigSchema.parse({ project: { name: "__defaults__" } }).qualityGates;

function hasExplicitQualityGateOverrides(config: QualityReportConfig): boolean {
  return JSON.stringify(config.qualityGates) !== JSON.stringify(DEFAULT_QUALITY_GATES);
}

export async function loadConfig(path: string): Promise<QualityReportConfig> {
  try {
    const content = await readFile(path, "utf8");
    const raw = parseYaml(content) as unknown;
    return QualityReportConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof YAMLParseError) throw new Error(`Invalid YAML in ${path}: ${error.message}`);
    throw error;
  }
}

export async function loadCustomQualityGates(path: string): Promise<CustomQualityGateFile | undefined> {
  try {
    await access(path);
  } catch {
    return undefined;
  }
  try {
    const content = await readFile(path, "utf8");
    const raw = parseYaml(content) as unknown;
    return CustomQualityGateFileSchema.parse(raw);
  } catch (error) {
    if (error instanceof YAMLParseError) throw new Error(`Invalid YAML in ${path}: ${error.message}`);
    throw error;
  }
}

export async function applyQualityProfile(
  config: QualityReportConfig,
  profile: string,
  qualityGatesPath?: string
): Promise<{ config: QualityReportConfig; enabled: boolean }> {
  const custom = qualityGatesPath ? await loadCustomQualityGates(qualityGatesPath) : undefined;
  const resolved = resolveQualityProfile(profile, custom, hasExplicitQualityGateOverrides(config) ? config.qualityGates : undefined);
  return {
    enabled: resolved.enabled,
    config: {
      ...config,
      qualityGates: resolved.qualityGates
    }
  };
}
