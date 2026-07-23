import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import {
  ProjectQualitySummarySchema,
  sortPortfolio,
  type PortfolioProject
} from "@quality-report/report-core";
function escape(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );
}

const READINESS_LABELS: Record<string, string> = {
  ready: "Ready",
  "ready-with-accepted-risks": "Ready with accepted risks",
  warning: "Warning",
  blocked: "Blocked",
  incomplete: "Incomplete"
};

const GATE_LABELS: Record<string, string> = {
  passed: "Gate passed",
  failed: "Gate failed",
  skipped: "Gate skipped",
  not_evaluated: "Gate not evaluated"
};

function chip(tone: string, label: string, title?: string) {
  return `<span class="chip chip-${tone}"${title ? ` title="${escape(title)}"` : ""}><span class="chip-mark" aria-hidden="true"></span>${escape(label)}</span>`;
}

function readinessChip(item: PortfolioProject) {
  const tone =
    item.readiness === "blocked"
      ? "fail"
      : item.readiness === "warning" || item.readiness === "incomplete"
        ? "warn"
        : "pass";
  return chip(tone, READINESS_LABELS[item.readiness] ?? item.readiness);
}

function gateChip(item: PortfolioProject) {
  const tone =
    item.qualityGate === "failed" ? "fail" : item.qualityGate === "passed" ? "pass" : "muted";
  return chip(tone, GATE_LABELS[item.qualityGate] ?? item.qualityGate);
}

/**
 * Card-level tone, independent of sort priority. A stale-but-otherwise-ready
 * project must read as a warning, not as a hard failure, so this cannot
 * simply reuse `item.priority` (which clamps stale reports into the top
 * failure band purely to keep them sorted first).
 */
function projectTone(item: PortfolioProject): "fail" | "warn" | "pass" | "neutral" {
  if (item.readiness === "blocked" || item.qualityGate === "failed") return "fail";
  if (item.stale || item.readiness === "warning" || item.readiness === "incomplete") return "warn";
  if (item.readiness === "ready" || item.readiness === "ready-with-accepted-risks") return "pass";
  return "neutral";
}

type MetricTone = "negative" | "caution" | "neutral";

function metric(label: string, value: number, tone: MetricTone) {
  const applied = value > 0 ? tone : "neutral";
  return `<div class="metric" data-tone="${applied}"><strong>${value}</strong><span>${escape(label)}</span></div>`;
}

function projectCard(item: PortfolioProject) {
  const name = item.reportUrl
    ? `<a href="${escape(item.reportUrl)}">${escape(item.projectName)}</a>`
    : escape(item.projectName);
  const updated = escape(item.generatedAt.slice(0, 10));
  return [
    `<li class="project" data-priority="${item.priority}" data-tone="${projectTone(item)}">`,
    `<div class="project-head"><h2>${name}</h2><span class="project-release">${item.release ? `Release ${escape(item.release)}` : "No release recorded"}</span></div>`,
    `<div class="project-chips">${readinessChip(item)}${gateChip(item)}${item.stale ? chip("warn", "Stale report", "This summary is older than the configured freshness window") : ""}</div>`,
    '<div class="project-metrics">',
    metric("Failed tests", item.failedTests, "negative"),
    metric("New failures", item.newFailures, "negative"),
    metric("Manual remaining", item.manualRemaining, "caution"),
    metric("Uncovered reqs", item.uncoveredRequirements, "caution"),
    metric("Security blockers", item.securityBlockers, "negative"),
    metric("Accepted risks", item.acceptedRisks, "neutral"),
    metric("Required actions", item.recommendedActions, "caution"),
    "</div>",
    `<div class="project-foot"><span>Updated ${updated}</span>${item.reportUrl ? `<a href="${escape(item.reportUrl)}">Open full report →</a>` : '<span class="muted">No report link provided</span>'}</div>`,
    "</li>"
  ].join("");
}

const PORTFOLIO_CSS = `
:root{--qp-bg:#f5f7f4;--qp-surface:#ffffff;--qp-surface-muted:#f8faf7;--qp-border:#d9e1d7;
--qp-text:#17201a;--qp-muted:#5d675f;--qp-primary:#1e6258;--qp-pass:#167246;--qp-fail:#b42318;
--qp-medium:#b54708;--qp-radius:8px;--qp-shadow:0 1px 2px rgba(23,32,26,.06)}
*{box-sizing:border-box}
body{margin:0;background:var(--qp-bg);color:var(--qp-text);
font:15px/1.5 system-ui,"Segoe UI",Roboto,sans-serif}
a{color:var(--qp-primary);font-weight:650;text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:none;box-shadow:0 0 0 2px var(--qp-surface),0 0 0 4px var(--qp-primary);border-radius:4px}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 48px}
header h1{margin:0;font-size:1.6rem;font-weight:750}
header p{color:var(--qp-muted);margin:6px 0 0;max-width:70ch}
.projects{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:16px;
grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.project{background:var(--qp-surface);border:1px solid var(--qp-border);
border-radius:var(--qp-radius);box-shadow:var(--qp-shadow);padding:16px 18px;
display:flex;flex-direction:column;gap:12px}
.project[data-tone="fail"]{border-left:4px solid var(--qp-fail)}
.project[data-tone="warn"]{border-left:4px solid var(--qp-medium)}
.project[data-tone="pass"]{border-left:4px solid var(--qp-pass)}
.project-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.project-head h2{margin:0;font-size:1.05rem;font-weight:720}
.project-release{color:var(--qp-muted);font-size:.84rem}
.project-chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;
font-size:.78rem;font-weight:650;border:1px solid var(--qp-border);background:var(--qp-surface-muted)}
.chip-mark{width:8px;height:8px;border-radius:50%;background:var(--qp-muted)}
.chip-pass{color:var(--qp-pass);border-color:rgba(22,114,70,.35);background:rgba(22,114,70,.06)}
.chip-pass .chip-mark{background:var(--qp-pass)}
.chip-fail{color:var(--qp-fail);border-color:rgba(180,35,24,.35);background:rgba(180,35,24,.06)}
.chip-fail .chip-mark{background:var(--qp-fail)}
.chip-warn{color:var(--qp-medium);border-color:rgba(181,71,8,.4);background:rgba(181,71,8,.06)}
.chip-warn .chip-mark{background:var(--qp-medium)}
.chip-muted{color:var(--qp-muted)}
.project-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;
border-top:1px solid var(--qp-border);padding-top:12px}
.metric{display:grid;gap:2px}
.metric strong{font-size:1.2rem;line-height:1.1}
.metric[data-tone="negative"] strong{color:var(--qp-fail)}
.metric[data-tone="caution"] strong{color:var(--qp-medium)}
.metric span{color:var(--qp-muted);font-size:.75rem}
.project-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
border-top:1px solid var(--qp-border);padding-top:10px;color:var(--qp-muted);font-size:.82rem;margin-top:auto}
.muted{color:var(--qp-muted)}
.empty{border:1px dashed var(--qp-border);border-radius:var(--qp-radius);
background:var(--qp-surface-muted);color:var(--qp-muted);padding:40px;text-align:center;margin-top:24px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export async function buildPortfolio(
  input: string,
  output: string,
  staleDays = 7,
  now = new Date()
) {
  const files = (
    await fg(["**/project-quality-summary.json", "*.json"], {
      cwd: input,
      absolute: true,
      onlyFiles: true
    })
  ).sort();
  const summaries = await Promise.all(
    files.map(async (file) => ({
      file,
      summary: ProjectQualitySummarySchema.parse(JSON.parse(await readFile(file, "utf8")))
    }))
  );
  const filesByProject = new Map<string, string[]>();
  for (const item of summaries)
    filesByProject.set(item.summary.projectKey, [
      ...(filesByProject.get(item.summary.projectKey) ?? []),
      path.relative(input, item.file).replace(/\\/g, "/")
    ]);
  const duplicates = [...filesByProject.entries()].filter(
    ([, projectFiles]) => projectFiles.length > 1
  );
  if (duplicates.length)
    throw new Error(
      `Duplicate project summary key(s): ${duplicates
        .map(([key, projectFiles]) => `${key} (${projectFiles.sort().join(", ")})`)
        .join("; ")}`
    );
  const projects = sortPortfolio(
    summaries.map((item) => item.summary),
    now,
    staleDays
  );
  await mkdir(path.join(output, "data"), { recursive: true });
  await writeFile(
    path.join(output, "data", "portfolio.json"),
    `${JSON.stringify({ schemaVersion: "1.0", generatedAt: now.toISOString(), staleDays, projects }, null, 2)}\n`
  );
  const body = projects.length
    ? `<ol class="projects">${projects.map(projectCard).join("")}</ol>`
    : '<div class="empty">No project summaries were found. Publish project-quality-summary.json files from your project reports to populate this portfolio.</div>';
  await writeFile(
    path.join(output, "index.html"),
    [
      "<!doctype html>",
      '<html lang="en"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Quality Portfolio</title>",
      `<style>${PORTFOLIO_CSS}</style>`,
      '</head><body><div class="wrap">',
      "<header><h1>Project quality portfolio</h1>",
      "<p>Projects are ordered by deterministic attention priority — blocked and failing projects come first. Stale reports are never shown as healthy.</p>",
      `<p>Generated ${escape(now.toISOString().slice(0, 10))} · ${projects.length} project(s) · summaries older than ${staleDays} day(s) are marked stale.</p>`,
      "</header>",
      `<main>${body}</main>`,
      "</div></body></html>"
    ].join("")
  );
  return projects;
}
