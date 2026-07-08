import { stableId, type SecurityFinding, type Severity } from "@quality-report/report-core";
import { numberOrUndefined, parserWarning, safeDisplayPath, toArray } from "./helpers.js";
import type { ParseContext, SecurityParseResult } from "./types.js";

type JsonRecord = Record<string, unknown>;

function text(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : undefined;
}

function messageText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as JsonRecord;
  return text(record.text) ?? text(record.markdown);
}

function sarifSeverity(rule: JsonRecord | undefined, result: JsonRecord): Severity {
  const level = (text(result.level) ?? "").toLowerCase();
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  if (level === "note") return "low";
  const props = (rule?.properties ?? {}) as JsonRecord;
  const severity = (text(props["security-severity"]) ?? text(props.severity) ?? "").toLowerCase();
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
  let json: JsonRecord;
  try {
    json = JSON.parse(content) as JsonRecord;
  } catch (error) {
    return {
      items: [],
      warnings: [
        parserWarning(
          context.sourcePath,
          "sarif.malformed",
          error instanceof Error ? error.message : "Malformed SARIF JSON file."
        )
      ]
    };
  }
  const items: SecurityFinding[] = [];
  for (const run of toArray(json.runs as JsonRecord[] | JsonRecord | undefined)) {
    const tool = run.tool as JsonRecord | undefined;
    const driver = tool?.driver as JsonRecord | undefined;
    const rules = new Map(
      toArray(driver?.rules as JsonRecord[] | JsonRecord | undefined).map((rule) => [
        String(rule.id),
        rule
      ])
    );
    for (const result of toArray(run.results as JsonRecord[] | JsonRecord | undefined)) {
      const ruleId = text(result.ruleId) ?? "";
      const rule = rules.get(ruleId);
      const properties = (rule?.properties ?? {}) as JsonRecord;
      const location = toArray(result.locations as JsonRecord[] | JsonRecord | undefined)[0];
      const physical = ((location?.physicalLocation as JsonRecord | undefined) ?? {}) as JsonRecord;
      const artifact = (physical.artifactLocation as JsonRecord | undefined) ?? {};
      const region = (physical.region as JsonRecord | undefined) ?? {};
      const message = result.message as JsonRecord | undefined;
      const resultText = messageText(message) ?? text(rule?.name) ?? ruleId;
      const tags = toArray(properties.tags as string[] | string | undefined)
        .map((tag) => text(tag))
        .filter((tag): tag is string => Boolean(tag));
      const helpUri = text(rule?.helpUri);
      const description = messageText(rule?.fullDescription) ?? messageText(rule?.shortDescription);
      const precision = text(properties.precision);
      const remediation = messageText(rule?.help);
      items.push({
        id: stableId(["sarif", ruleId, text(artifact.uri), text(region.startLine), resultText]),
        tool: "codeql",
        ...(ruleId ? { ruleId } : {}),
        title: text(rule?.name) ?? (ruleId || "SARIF finding"),
        message: resultText,
        severity: sarifSeverity(rule, result),
        ...(helpUri ? { helpUri } : {}),
        ...(description ? { description } : {}),
        ...(precision ? { precision } : {}),
        tags,
        ...(remediation ? { remediation } : {}),
        file: safeDisplayPath(typeof artifact.uri === "string" ? artifact.uri : undefined),
        line: numberOrUndefined(region.startLine),
        sourcePath: context.sourcePath
      });
    }
  }
  return {
    items,
    warnings:
      items.length === 0
        ? [
            parserWarning(
              context.sourcePath,
              "sarif.no-results",
              "No findings found in SARIF file."
            )
          ]
        : []
  };
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
  let json: JsonRecord;
  try {
    json = JSON.parse(content) as JsonRecord;
  } catch (error) {
    return {
      items: [],
      warnings: [
        parserWarning(
          context.sourcePath,
          "zap.malformed",
          error instanceof Error ? error.message : "Malformed OWASP ZAP JSON file."
        )
      ]
    };
  }
  const sites = toArray((json.site ?? json.sites) as JsonRecord[] | JsonRecord | undefined);
  const alerts =
    sites.length > 0
      ? sites.flatMap((site) => toArray(site.alerts as JsonRecord[] | JsonRecord))
      : [];
  const items = alerts.map((alert) => {
    const instances = toArray(alert.instances as JsonRecord[] | JsonRecord | undefined);
    const first = instances[0];
    const title = text(alert.alert) ?? text(alert.name) ?? "ZAP finding";
    const message = text(alert.desc) ?? text(alert.description);
    const confidence = text(alert.confidence);
    const riskCode = text(alert.riskcode);
    const evidence = text(first?.evidence);
    const cweId = text(alert.cweid);
    const wascId = text(alert.wascid);
    const remediation = text(alert.solution);
    return {
      id: stableId(["zap", text(alert.pluginid), title, text(first?.uri)]),
      tool: "zap" as const,
      ruleId: text(alert.pluginid),
      title,
      ...(message ? { message } : {}),
      severity: zapRisk(text(alert.riskdesc) ?? text(alert.riskcode) ?? text(alert.risk) ?? ""),
      tags: [],
      ...(confidence ? { confidence } : {}),
      ...(riskCode ? { riskCode } : {}),
      ...(evidence ? { evidence } : {}),
      ...(cweId ? { cweId } : {}),
      ...(wascId ? { wascId } : {}),
      ...(remediation ? { remediation } : {}),
      url: safeDisplayPath(typeof first?.uri === "string" ? first.uri : undefined),
      sourcePath: context.sourcePath
    };
  });
  return {
    items,
    warnings:
      items.length === 0
        ? [
            parserWarning(
              context.sourcePath,
              "zap.no-alerts",
              "No alerts found in OWASP ZAP JSON file."
            )
          ]
        : []
  };
}
