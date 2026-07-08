export function statusColor(status?: string) {
  if (status === "passed" || status === "covered") return "success";
  if (status === "failed" || status === "missing") return "error";
  if (status === "broken") return "deep-purple";
  if (status === "skipped" || status === "warning" || status === "extra") return "warning";
  return "grey";
}

export function severityColor(severity?: string) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "success";
  if (severity === "info") return "info";
  return "grey";
}

export function gateColor(status?: string) {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  if (status === "warning") return "warning";
  return "grey";
}

export function formatDuration(value?: number) {
  if (value === undefined) return "n/a";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function formatPercent(value?: number) {
  return value === undefined ? "n/a" : `${Math.round(value * 10) / 10}%`;
}

export function formatBytes(value?: number) {
  if (value === undefined) return "directory";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortSha(value?: string) {
  return value ? value.slice(0, 12) : "n/a";
}
