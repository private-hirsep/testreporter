import { stableId, type SecurityFinding, type Severity } from "@quality-report/report-core";
import { numberOrUndefined, toArray } from "./helpers.js";
import type { ParseContext, SecurityParseResult } from "./types.js";

type JsonRecord = Record<string, unknown>;

function sarifSeverity(rule: JsonRecord | undefined, result: JsonRecord): Severity {
  const level = String(result.level ?? "").toLowerCase();
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  if (level === "note") return "low";
  const props = (rule?.properties ?? {}) as JsonRecord;
  const severity = String(props["security-severity"] ?? props.severity ?? "").toLowerCase();
  const numeric = Number(severity);
  if (Number.isFinite(numeric)) {
    if (numeric >= 9) return "critical";
    if (numeric >= 7) return "high";
    if (numeric >= 4) return "medium";
    if (numeric > 0) return "low";
  }
  if (["critical", "high", "medium", "low", "info"].includes(severity)) return severity as Severity;
  return "unknown";
}

export function parseSarif(content: string, context: ParseContext): SecurityParseResult {
  const json = JSON.parse(content) as JsonRecord;
  const items: SecurityFinding[] = [];
  for (const run of toArray(json.runs as JsonRecord[] | JsonRecord | undefined)) {
    const tool = run.tool as JsonRecord | undefined;
    const driver = tool?.driver as JsonRecord | undefined;
    const rules = new Map(
      toArray(driver?.rules as JsonRecord[] | JsonRecord | undefined).map((rule) => [String(rule.id), rule])
    );
    for (const result of toArray(run.results as JsonRecord[] | JsonRecord | undefined)) {
      const ruleId = String(result.ruleId ?? "");
      const rule = rules.get(ruleId);
      const location = toArray(result.locations as JsonRecord[] | JsonRecord | undefined)[0];
      const physical = ((location?.physicalLocation as JsonRecord | undefined) ?? {}) as JsonRecord;
      const artifact = (physical.artifactLocation as JsonRecord | undefined) ?? {};
      const region = (physical.region as JsonRecord | undefined) ?? {};
      const message = result.message as JsonRecord | undefined;
      const text = String(message?.text ?? rule?.name ?? ruleId);
      items.push({
        id: stableId(["sarif", ruleId, artifact.uri as string, region.startLine as string, text]),
        tool: "codeql",
        ...(ruleId ? { ruleId } : {}),
        title: String(rule?.name ?? (ruleId || "SARIF finding")),
        message: text,
        severity: sarifSeverity(rule, result),
        file: typeof artifact.uri === "string" ? artifact.uri : undefined,
        line: numberOrUndefined(region.startLine),
        sourcePath: context.sourcePath
      });
    }
  }
  return { items, warnings: [] };
}

function zapRisk(risk: string): Severity {
  const normalized = risk.toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  if (normalized.includes("low")) return "low";
  if (normalized.includes("informational") || normalized.includes("info")) return "info";
  return "unknown";
}

export function parseZapJson(content: string, context: ParseContext): SecurityParseResult {
  const json = JSON.parse(content) as JsonRecord;
  const sites = toArray((json.site ?? json.sites) as JsonRecord[] | JsonRecord | undefined);
  const alerts = sites.length > 0 ? sites.flatMap((site) => toArray(site.alerts as JsonRecord[] | JsonRecord)) : [];
  const items = alerts.map((alert) => {
    const instances = toArray(alert.instances as JsonRecord[] | JsonRecord | undefined);
    const first = instances[0];
    const title = String(alert.alert ?? alert.name ?? "ZAP finding");
    return {
      id: stableId(["zap", alert.pluginid as string, title, first?.uri as string]),
      tool: "zap" as const,
      ruleId: alert.pluginid !== undefined ? String(alert.pluginid) : undefined,
      title,
      message: String(alert.desc ?? alert.description ?? ""),
      severity: zapRisk(String(alert.riskdesc ?? alert.riskcode ?? alert.risk ?? "")),
      url: typeof first?.uri === "string" ? first.uri : undefined,
      sourcePath: context.sourcePath
    };
  });
  return { items, warnings: [] };
}
