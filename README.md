# Quality Report Platform

Quality Report Platform is a static Quality Portal for test, coverage, requirement, and security artifacts. It gives teams one generated report, one PR summary, and one quality-gate result without forcing every project to run tests the same way.

Your project runs tests however it wants. Your project uploads standard artifacts. The Quality Portal workflow consumes those artifacts, generates a static report, comments on PRs, publishes artifacts or GitHub Pages, and optionally fails on quality gates.

## What It Solves

- Normalizes JUnit, Playwright, Vitest, JaCoCo, LCOV, Istanbul, Cobertura, SARIF, ZAP, requirement, and raw report artifacts.
- Produces a GitHub Pages-compatible static report with `data/manifest.json`, downloadable raw artifacts, PR comment markdown, and `meta/quality-summary.json`.
- Applies quality profiles: `off`, `relaxed`, `standard`, `strict`, `release`, or custom profiles from `quality-gates.yml`.
- Supports publish modes: `auto`, `none`, `artifact`, `pages`, and `pages-and-artifact`.
- Supports PR comment modes: `auto`, `off`, `minimal`, and `full`; PR comments update in place by default using a hidden marker.

## What It Does Not Do

- It does not run your test suite.
- It does not replace Maven, Gradle, npm, pnpm, yarn, Pytest, Vitest, Playwright, CodeQL, ZAP, or custom CI jobs.
- It does not require a backend service, database, token broker, or server-side renderer.
- It does not recommend publishing full GitHub Pages reports from every PR.

## Quick Start

```bash
npm install
npm run build
npm run quality-report -- generate \
  --config examples/minimal/quality-report.yml \
  --quality-gates examples/minimal/quality-gates.yml \
  --input examples/minimal/quality-artifacts \
  --output dist/example-report \
  --quality-profile relaxed \
  --zip
```

Open `dist/example-report/index.html` or publish `dist/example-report` to GitHub Pages.

## External Project Setup

1. Keep your existing jobs that run tests, coverage, security scans, and requirement checks.
2. Upload their output with `actions/upload-artifact`.
3. Add a job that calls `your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1`.
4. Start with `quality-profile: off` or `relaxed`, then move to `standard`, `strict`, or `release` when the signal is stable.

## Artifact Layout

Recommended artifact contents:

```text
quality-artifacts/
  tests/backend/junit/**/*.xml
  tests/frontend/junit/**/*.xml
  tests/e2e/playwright/**/*.json
  coverage/backend/jacoco.xml
  coverage/frontend/lcov.info
  coverage/frontend/coverage-summary.json
  requirements/expected.csv
  requirements/mapping.json
  security/codeql/**/*.sarif
  security/zap/**/*.json
```

The layout is configurable. Globs in `quality-report.yml` are resolved relative to the downloaded artifact directory.

## Minimal `quality-report.yml`

```yaml
project:
  name: Example Service
  repository: your-org/example-service

artifacts:
  tests:
    backend:
      junit: "tests/backend/junit/**/*.xml"
    e2e:
      playwrightJson: "tests/e2e/playwright/**/*.json"
  coverage:
    frontend:
      lcov: "coverage/frontend/lcov.info"
  security:
    codeqlSarif: "security/codeql/**/*.sarif"

requirements:
  keyPattern: "[A-Z]+-[0-9]+"
```

## Optional `quality-gates.yml`

```yaml
qualityGates:
  tests:
    allowFailed: 0
    allowBroken: 0
  coverage:
    totalMinimum: 70
  requirements:
    minimum: 75
    failOnMissing: false
  security:
    maxCritical: 0
    maxHigh: 0

qualityGateProfiles:
  team-relaxed:
    tests:
      allowFailed: 3
      allowBroken: 1
    coverage:
      totalMinimum: 60
    requirements:
      minimum: 50
      failOnMissing: false
    security:
      maxCritical: 0
      maxHigh: 5
```

## Modes And Profiles

Quality profiles select gate thresholds: `off` reports only, `relaxed` tolerates early adoption noise, `standard` is the normal CI default, `strict` is for mature branches, and `release` is for release readiness.

Publish modes control delivery. `auto` uses artifacts for PRs and Pages plus artifacts elsewhere. `none` only generates the report. `artifact` uploads the report. `pages` deploys GitHub Pages. `pages-and-artifact` does both and requires Pages permissions.

PR comment modes control summaries. `minimal` is the normal PR mode, `full` includes all gate checks, `off` disables comments, and `auto` uses `minimal` only on PRs. In short, pull requests should usually use `pr-comment-mode: minimal`.

## Recommended Setups By Event

- Pull request: `publish-mode: none` or `artifact`, `pr-comment-mode: minimal`, `fail-on-quality-gate: true`.
- Merge queue: `publish-mode: artifact`, `pr-comment-mode: off`, `fail-on-quality-gate: true`.
- Workflow dispatch: `publish-mode: artifact` or `pages-and-artifact`, `pr-comment-mode: off` or `full`, `fail-on-quality-gate: false` while experimenting.
- Release: `quality-profile: release`, `publish-mode: pages-and-artifact`, `pr-comment-mode: off`, `fail-on-quality-gate: true`.
- Push to main: `publish-mode: artifact` or `pages-and-artifact`, `pr-comment-mode: off`.

## Reusable Workflow Usage

PR minimal comment only:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      artifact-path: quality-artifacts
      config-path: quality-report.yml
      quality-gates-path: quality-gates.yml
      quality-profile: standard
      publish-mode: none
      pr-comment-mode: minimal
      update-pr-comment: true
      fail-on-quality-gate: true
```

PR minimal comment plus artifact:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      quality-profile: standard
      publish-mode: artifact
      pr-comment-mode: minimal
      fail-on-quality-gate: true
```

Manual full Pages publish:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      quality-profile: strict
      publish-mode: pages-and-artifact
      pr-comment-mode: off
      fail-on-quality-gate: false
```

Release publish:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      quality-profile: release
      publish-mode: pages-and-artifact
      pr-comment-mode: off
      fail-on-quality-gate: true
```

Early adoption/report-only:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      quality-profile: off
      publish-mode: artifact
      pr-comment-mode: minimal
      fail-on-quality-gate: false
```

## GitHub Pages Publishing

Use `publish-mode: pages-and-artifact` for manual runs, releases, or trusted main-branch publishing. Avoid publishing Pages from every PR. Pages deployment needs `pages: write` and `id-token: write`.

## Permissions

Recommended caller permissions:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: read
  pages: write
  id-token: write
```

`issues: write` is required for PR comments because GitHub stores PR comments as issue comments. `pages: write` and `id-token: write` are required for `pages` and `pages-and-artifact`. If PR comments are configured outside a PR, the workflow skips them cleanly. If Pages or comments are explicitly requested without sufficient permission, GitHub will fail the responsible step with a permission error.

## Requirement Coverage Setup

Add `requirements/expected.csv` with one requirement key per row and optional `requirements/mapping.json` for explicit test-to-requirement mappings. Test names are also scanned with `requirements.keyPattern`, such as `JIRA-123`.

## Security Reports Setup

Upload SARIF under `security/codeql/` and ZAP JSON under `security/zap/`, or map different paths in `quality-report.yml`. The static report links raw reports as downloads and does not embed arbitrary third-party HTML in the SPA.

## Troubleshooting

- No files in the report: verify artifact names match `artifact-pattern` and paths inside the downloaded artifact match `quality-report.yml`.
- No PR comment: verify the event is `pull_request`, `pr-comment-mode` is not `off`, and `issues: write` is granted.
- Pages failed: verify repository Pages is enabled and the caller grants `pages: write` and `id-token: write`.
- Gate failed too early: use the reusable workflow or run `generate` without `--fail-on-quality-gate`; the workflow fails only after upload/comment/publish steps.

## Local Development

This repository uses npm workspaces.

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run check:workflows-docs
```

## Dogfood Workflow Explanation

`Dogfood Quality Report` runs on pull requests, manual dispatch, and pushes to `main`. It uploads `examples/minimal/quality-artifacts` as `quality-dogfood-artifacts`, then calls `.github/workflows/publish-quality-report.yml` with the same input style external projects use.

PR dogfood uses `publish-mode: artifact`, `pr-comment-mode: minimal`, and `fail-on-quality-gate: false` to avoid noisy PR failures. Manual dogfood can test `pages-and-artifact`, `full` comments, strict profiles, and final gate failure.

## More Documentation

- [Artifact contract](docs/artifact-contract.md)
- [Configuration](docs/configuration.md)
- [Supported formats](docs/supported-formats.md)
- [Requirement coverage](docs/requirement-coverage.md)
- [Quality gates](docs/quality-gates.md)
- [GitHub Actions integration](docs/github-actions.md)
- [Security model](docs/security.md)
- [Local development](docs/local-development.md)
