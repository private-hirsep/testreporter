# Architecture

Testreporter is a build-time CLI plus a static Vue report. Adapters normalize
supported test and coverage artifacts into `normalized-report.json`; core derives
catalogue, execution, readiness, evidence, history, and portfolio contracts. The
browser reads generated JSON and requires no service.

Compact retained history lives on `quality-history`. It contains immutable
execution summaries, not raw reports or attachments. A trusted workflow refetches,
merges, pushes without force, and verifies exact remote content. The finalized
static report is then deployed to GitHub Pages.

Project workflows may publish `project-quality-summary.json` to a summary store.
A separate static portfolio build reads those summaries. This is intentionally not
same-run artifact aggregation.

Not implemented: backend/database, Jira synchronization, historical requirement
state transitions, AI prioritization, or full raw artifact history.
