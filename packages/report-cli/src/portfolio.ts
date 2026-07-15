import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { ProjectQualitySummarySchema, sortPortfolio } from "@quality-report/report-core";
function escape(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
export async function buildPortfolio(input: string, output: string, staleDays = 7, now = new Date()) {
  const files = (await fg(["**/project-quality-summary.json", "*.json"], { cwd: input, absolute: true, onlyFiles: true })).sort();
  const projects = sortPortfolio(await Promise.all(files.map(async (file) => ProjectQualitySummarySchema.parse(JSON.parse(await readFile(file, "utf8"))))), now, staleDays);
  await mkdir(path.join(output, "data"), { recursive: true }); await writeFile(path.join(output, "data", "portfolio.json"), `${JSON.stringify({ schemaVersion: "1.0", generatedAt: now.toISOString(), staleDays, projects }, null, 2)}\n`);
  const rows = projects.map((item) => `<tr data-priority="${item.priority}"><td>${item.reportUrl ? `<a href="${escape(item.reportUrl)}">${escape(item.projectName)}</a>` : escape(item.projectName)}</td><td>${escape(item.release ?? "n/a")}</td><td>${escape(item.readiness)}${item.stale ? " (stale)" : ""}</td><td>${item.failedTests}</td><td>${item.manualRemaining}</td><td>${item.uncoveredRequirements}</td><td>${item.securityBlockers}</td><td>${escape(item.generatedAt)}</td></tr>`).join("");
  await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Quality Portfolio</title><style>body{font:16px system-ui;margin:2rem;color:#17201f}table{border-collapse:collapse;width:100%}th,td{padding:.75rem;border-bottom:1px solid #ccd6d4;text-align:left}tr[data-priority="1"],tr[data-priority="2"]{background:#fff0ef}a{color:#145e59}</style></head><body><h1>Project quality portfolio</h1><p>Projects are ordered by deterministic attention priority. Stale reports are never shown as healthy.</p><table><thead><tr><th>Project</th><th>Release</th><th>Readiness</th><th>Failures</th><th>Manual remaining</th><th>Uncovered</th><th>Security blockers</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table></body></html>`); return projects;
}
