# Quality Report Platform

Static Testing Bible and Quality Portal for organization-wide test, coverage,
requirement, and security reporting from CI artifacts.

The platform generates a professional static report from files your existing CI
already produces. It does not run your tests, require a backend server, require a
database, or force a specific test runner. Teams keep their Maven, Gradle, npm,
pnpm, yarn, Pytest, Vitest, Playwright, CodeQL, ZAP, or custom workflows and
publish standard artifacts that this tool normalizes into one report model.

## What This Solves

- One static quality portal for many repositories.
- Consistent artifact contracts across teams.
- Normalized test health, retries, flaky signals, durations, layers, and
  requirements.
- Combined backend/frontend coverage and low-coverage file visibility.
- Requirement coverage with missing and extra requirement tracking.
- CodeQL/SARIF and OWASP ZAP security finding summaries.
- Parser warnings and downloadable raw evidence from CI runs.
- Quality gates that fail CI while still generating a complete report.
- GitHub Pages-compatible output with no server-side runtime.

## Supported Formats

- Tests: Generic JUnit XML, Pytest JUnit XML, Maven Surefire/Failsafe JUnit XML,
  Vitest JSON, Vitest JUnit XML, Playwright JSON, Playwright JUnit XML.
- Coverage: JaCoCo XML, JaCoCo CSV, Istanbul `coverage-summary.json`, LCOV,
  Cobertura XML.
- Security: CodeQL/SARIF, OWASP ZAP JSON.
- Requirements: expected requirement CSV, explicit requirement mapping JSON.
- Raw evidence: optional downloadable files or directories copied under `raw/`.

## Quick Start: Local Generation

```bash
npm install
npm run build
npm run quality-report -- validate --config quality-report.yml --input quality-artifacts
npm run quality-report -- generate --config quality-report.yml --input quality-artifacts --output dist/report --zip
```

Open `dist/report/index.html`, or publish `dist/report` to GitHub Pages.

For this repository's sample:

```bash
npm run quality-report -- generate \
  --config examples/minimal/quality-report.yml \
  --input examples/minimal/quality-artifacts \
  --output dist/example-report \
  --quality-profile standard \
  --zip
```

Node/Vitest frontend:

```yaml
artifacts:
  tests:
    frontend:
      junit: "quality-artifacts/tests/frontend/junit/**/*.xml"
      vitestJson: "quality-artifacts/tests/frontend/vitest/**/*.json"
  coverage:
    frontend:
      lcov: "quality-artifacts/coverage/frontend/lcov.info"
      summaryJson: "quality-artifacts/coverage/frontend/coverage-summary.json"
```

Playwright E2E:

```yaml
artifacts:
  tests:
    e2e:
      junit: "quality-artifacts/tests/e2e/junit/**/*.xml"
      playwrightJson: "quality-artifacts/tests/e2e/playwright/**/*.json"
```

Pytest:

```yaml
artifacts:
  tests:
    backend:
      pytestJunit: "quality-artifacts/tests/backend/junit/**/*.xml"
```

CodeQL/SARIF:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    permissions:
      contents: read
      actions: read
      issues: write
      pull-requests: read
    with:
      artifact-pattern: quality-*
      quality-profile: standard
      publish-mode: none
      pr-comment-mode: minimal
      fail-on-quality-gate: true
```

Recommended modes:

- Pull requests: `publish-mode: none` or `artifact`, `pr-comment-mode: minimal`
- Manual runs: `publish-mode: pages-and-artifact`, `pr-comment-mode: off`
- Releases: `publish-mode: pages-and-artifact`, `pr-comment-mode: off`
- Merge queue: `quality-profile: strict`, `publish-mode: artifact` or `none`
- Early adoption: `quality-profile: relaxed` or `off`

## Documentation

- [Getting started](docs/getting-started.md)
- [Artifact contract](docs/artifact-contract.md)
- [Configuration](docs/configuration.md)
- [Supported formats](docs/supported-formats.md)
- [Requirement coverage](docs/requirement-coverage.md)
- [Quality gates](docs/quality-gates.md)
- [Adoption guide](docs/adoption-guide.md)
- [Security model](docs/security.md)
- [History model](docs/history.md)
- [GitHub Actions integration](docs/github-actions.md)
- [Local development](docs/local-development.md)
- [Troubleshooting](docs/troubleshooting.md)

## Package Manager

This repository uses npm workspaces. npm is available with Node.js LTS, keeps
consumer setup simple, and avoids adding another package manager requirement for
the first milestone.
