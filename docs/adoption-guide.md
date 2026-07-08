# Adoption Guide

1. Generate standard artifacts from existing CI jobs: JUnit XML, Playwright JSON, Vitest JSON, coverage reports, SARIF, ZAP JSON, and requirement files.
2. Upload those artifacts without changing how tests are run.
3. Add `quality-report.yml`.
4. Run `npm run quality-report -- validate`.
5. Generate a local report and inspect the static site.
6. Add the canonical reusable workflow, `.github/workflows/publish-quality-report.yml`.
7. Start with `quality-profile: off` or `relaxed` and `fail-on-quality-gate: false`.
8. Move to `standard`, `strict`, or `release` when the signal is stable.

The platform standardizes the artifact contract, report generation, comments, delivery modes, and quality gates. It does not standardize every project's build or test execution commands.

History is represented in the static data model. The current implementation records the current run in the generated manifest.
