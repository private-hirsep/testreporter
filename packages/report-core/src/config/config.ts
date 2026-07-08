import { z } from "zod";

const MaybeGlobSchema = z.union([z.string(), z.array(z.string())]).optional();

export const QualityReportConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    repository: z.string().optional()
  }),
  artifacts: z
    .object({
      tests: z
        .object({
          backend: z
            .object({
              junit: MaybeGlobSchema,
              pytestJunit: MaybeGlobSchema
            })
            .optional(),
          frontend: z
            .object({
              junit: MaybeGlobSchema,
              vitestJson: MaybeGlobSchema
            })
            .optional(),
          e2e: z
            .object({
              junit: MaybeGlobSchema,
              playwrightJson: MaybeGlobSchema
            })
            .optional()
        })
        .optional(),
      coverage: z
        .object({
          backend: z
            .object({
              jacocoXml: MaybeGlobSchema,
              jacocoCsv: MaybeGlobSchema,
              coberturaXml: MaybeGlobSchema,
              lcov: MaybeGlobSchema,
              summaryJson: MaybeGlobSchema,
              html: MaybeGlobSchema
            })
            .optional(),
          frontend: z
            .object({
              jacocoXml: MaybeGlobSchema,
              coberturaXml: MaybeGlobSchema,
              lcov: MaybeGlobSchema,
              summaryJson: MaybeGlobSchema,
              html: MaybeGlobSchema
            })
            .optional()
        })
        .optional(),
      requirements: z
        .object({
          expectedKeys: MaybeGlobSchema,
          mapping: MaybeGlobSchema
        })
        .optional(),
      security: z
        .object({
          codeqlSarif: MaybeGlobSchema,
          zapJson: MaybeGlobSchema
        })
        .optional(),
      raw: MaybeGlobSchema
    })
    .default({}),
  requirements: z
    .object({
      keyPattern: z
        .string()
        .refine(
          (pattern) => {
            try {
              new RegExp(pattern, "g");
              return true;
            } catch {
              return false;
            }
          },
          { message: "requirements.keyPattern must be a valid regular expression" }
        )
        .default("[A-Z]+-[0-9]+")
    })
    .default({ keyPattern: "[A-Z]+-[0-9]+" }),
  qualityGates: z
    .object({
      tests: z
        .object({
          allowFailed: z.number().int().nonnegative().default(0),
          allowBroken: z.number().int().nonnegative().default(0)
        })
        .default({ allowFailed: 0, allowBroken: 0 }),
      coverage: z
        .object({
          totalMinimum: z.number().min(0).max(100).optional(),
          backendMinimum: z.number().min(0).max(100).optional(),
          frontendMinimum: z.number().min(0).max(100).optional()
        })
        .default({}),
      requirements: z
        .object({
          minimum: z.number().min(0).max(100).optional(),
          failOnMissing: z.boolean().default(false)
        })
        .default({ failOnMissing: false }),
      security: z
        .object({
          maxCritical: z.number().int().nonnegative().default(0),
          maxHigh: z.number().int().nonnegative().default(0)
        })
        .default({ maxCritical: 0, maxHigh: 0 })
    })
    .default({})
});

export type QualityReportConfig = z.infer<typeof QualityReportConfigSchema>;

export function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
