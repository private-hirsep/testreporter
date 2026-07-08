import { z } from "zod";
import { QualityReportConfigSchema, type QualityReportConfig } from "../config/config.js";

export const BuiltInQualityProfileSchema = z.enum([
  "off",
  "relaxed",
  "standard",
  "strict",
  "release"
]);
export const QualityProfileNameSchema = z.string().min(1);

export type BuiltInQualityProfile = z.infer<typeof BuiltInQualityProfileSchema>;
export type QualityProfileName = BuiltInQualityProfile | "custom" | string;
export type QualityGateSettings = QualityReportConfig["qualityGates"];
export type QualityGateOverrides = {
  enabled?: boolean | undefined;
  tests?:
    | {
        allowFailed?: number | undefined;
        allowBroken?: number | undefined;
        allowSkipped?: number | null | undefined;
      }
    | undefined;
  coverage?:
    | {
        totalMinimum?: number | undefined;
        backendMinimum?: number | undefined;
        frontendMinimum?: number | undefined;
      }
    | undefined;
  requirements?:
    | {
        minimum?: number | undefined;
        failOnMissing?: boolean | undefined;
        failOnExtra?: boolean | undefined;
      }
    | undefined;
  security?:
    | {
        maxCritical?: number | undefined;
        maxHigh?: number | undefined;
        maxMedium?: number | null | undefined;
        maxLow?: number | null | undefined;
      }
    | undefined;
  warnings?: { maxWarnings?: number | null | undefined } | undefined;
};

export const CustomQualityGateFileSchema = z.object({
  profiles: z
    .record(
      z.object({
        extends: z.string().min(1).optional(),
        tests: z
          .object({
            allowFailed: z.number().int().nonnegative().optional(),
            allowBroken: z.number().int().nonnegative().optional(),
            allowSkipped: z.number().int().nonnegative().nullable().optional()
          })
          .optional(),
        coverage: z
          .object({
            totalMinimum: z.number().min(0).max(100).optional(),
            backendMinimum: z.number().min(0).max(100).optional(),
            frontendMinimum: z.number().min(0).max(100).optional()
          })
          .optional(),
        requirements: z
          .object({
            minimum: z.number().min(0).max(100).optional(),
            failOnMissing: z.boolean().optional(),
            failOnExtra: z.boolean().optional()
          })
          .optional(),
        security: z
          .object({
            maxCritical: z.number().int().nonnegative().optional(),
            maxHigh: z.number().int().nonnegative().optional(),
            maxMedium: z.number().int().nonnegative().nullable().optional(),
            maxLow: z.number().int().nonnegative().nullable().optional()
          })
          .optional(),
        warnings: z
          .object({
            maxWarnings: z.number().int().nonnegative().nullable().optional()
          })
          .optional()
      })
    )
    .default({})
});

export type CustomQualityProfile = z.infer<typeof CustomQualityGateFileSchema>["profiles"][string];
export type CustomQualityGateFile = z.infer<typeof CustomQualityGateFileSchema>;

export const BUILT_IN_QUALITY_PROFILES: Record<
  BuiltInQualityProfile,
  QualityGateSettings & { enabled: boolean }
> = {
  off: {
    enabled: false,
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: {},
    requirements: { failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  },
  relaxed: {
    enabled: true,
    tests: { allowFailed: 3, allowBroken: 2 },
    coverage: { totalMinimum: 70, backendMinimum: 70, frontendMinimum: 60 },
    requirements: { minimum: 75, failOnMissing: false, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 5 },
    warnings: { maxWarnings: 20 }
  },
  standard: {
    enabled: true,
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 80, backendMinimum: 80, frontendMinimum: 75 },
    requirements: { minimum: 90, failOnMissing: true, failOnExtra: false },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 3 },
    warnings: { maxWarnings: 10 }
  },
  strict: {
    enabled: true,
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 85, backendMinimum: 85, frontendMinimum: 80 },
    requirements: { minimum: 100, failOnMissing: true, failOnExtra: true },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  },
  release: {
    enabled: true,
    tests: { allowFailed: 0, allowBroken: 0 },
    coverage: { totalMinimum: 85, backendMinimum: 85, frontendMinimum: 85 },
    requirements: { minimum: 100, failOnMissing: true, failOnExtra: true },
    security: { maxCritical: 0, maxHigh: 0, maxMedium: 0 },
    warnings: { maxWarnings: 0 }
  }
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeQualityGates(
  base: QualityGateSettings,
  override?: QualityGateOverrides
): QualityGateSettings {
  return QualityReportConfigSchema.shape.qualityGates.parse({
    enabled: override?.enabled ?? base.enabled,
    tests: { ...base.tests, ...override?.tests },
    coverage: { ...base.coverage, ...override?.coverage },
    requirements: { ...base.requirements, ...override?.requirements },
    security: { ...base.security, ...override?.security },
    warnings: { ...base.warnings, ...override?.warnings }
  });
}

export function resolveQualityProfile(
  selectedProfile: string,
  customFile?: CustomQualityGateFile,
  configOverrides?: QualityGateOverrides
): { profile: string; enabled: boolean; qualityGates: QualityGateSettings } {
  const seen = new Set<string>();

  const resolve = (name: string): { enabled: boolean; qualityGates: QualityGateSettings } => {
    if (seen.has(name))
      throw new Error(`Quality gate profile "${name}" has a circular extends chain.`);
    seen.add(name);

    const builtIn = BUILT_IN_QUALITY_PROFILES[name as BuiltInQualityProfile];
    if (builtIn) {
      const { enabled, ...qualityGates } = builtIn;
      return {
        enabled,
        qualityGates: QualityReportConfigSchema.shape.qualityGates.parse(clone(qualityGates))
      };
    }

    const custom = customFile?.profiles?.[name];
    if (!custom) {
      throw new Error(
        `Unknown quality gate profile "${name}". Use one of off, relaxed, standard, strict, release or define it in the custom quality gate file.`
      );
    }

    const parent = resolve(custom.extends ?? "standard");
    return {
      enabled: parent.enabled,
      qualityGates: mergeQualityGates(parent.qualityGates, custom)
    };
  };

  const resolved = resolve(selectedProfile === "custom" ? "custom" : selectedProfile);
  return {
    profile: selectedProfile,
    enabled: resolved.enabled,
    qualityGates: mergeQualityGates(resolved.qualityGates, configOverrides)
  };
}
