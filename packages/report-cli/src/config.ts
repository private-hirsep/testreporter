import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { QualityReportConfigSchema, type QualityReportConfig } from "@quality-report/report-core";

export async function loadConfig(path: string): Promise<QualityReportConfig> {
  const content = await readFile(path, "utf8");
  const raw = parseYaml(content) as unknown;
  return QualityReportConfigSchema.parse(raw);
}
