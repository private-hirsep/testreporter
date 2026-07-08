# Adoption Guide

1. Generate JUnit XML, Playwright JSON, Vitest JSON, JaCoCo, Istanbul/LCOV,
   SARIF, and ZAP JSON from existing CI jobs.
2. Upload those artifacts without changing how tests are run.
3. Add `quality-report.yml`.
4. Run `quality-report validate` locally.
5. Run `quality-report generate` locally and inspect the static site.
6. Add the composite GitHub Action or reusable publish workflow.
7. Publish the generated directory to GitHub Pages.
8. Gradually add requirement coverage, stricter gates, history, and raw report
   downloads.

The platform standardizes reporting contracts and quality gates, not every
project's build or test execution commands.

History is represented in the static data model from milestone one. The current
implementation records the current run and leaves room for later trend imports
without changing the UI contract.
