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
  --zip
```

## Quick Start: GitHub Actions

Test-running workflows remain project-specific. This tool consumes artifacts and
does not force a specific runner.

```yaml
name: Quality Report

on:
  workflow_dispatch:
  pull_request:
  merge_group:
    types: [checks_requested]

permissions:
  contents: read
  actions: read
  pages: write
  id-token: write

jobs:
  publish-quality-report:
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4

      - name: Download quality artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: quality-*
          path: quality-artifacts
          merge-multiple: true

      - name: Generate quality report
        uses: your-org/quality-report-platform/actions/generate-report@v1
        with:
          config-path: quality-report.yml
          input-path: quality-artifacts
          output-path: dist/report

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/report

      - name: Deploy Pages
        uses: actions/deploy-pages@v4
```

Required permissions are `contents: read`, `actions: read` when downloading
artifacts, `pages: write` when deploying Pages, and `id-token: write` when
deploying Pages.

## Minimal `quality-report.yml`

```yaml
project:
  name: Example Project
  repository: example-org/example-repo

artifacts:
  tests:
    backend:
      junit: "quality-artifacts/tests/backend/junit/**/*.xml"
    frontend:
      junit: "quality-artifacts/tests/frontend/junit/**/*.xml"
      vitestJson: "quality-artifacts/tests/frontend/vitest/**/*.json"
    e2e:
      junit: "quality-artifacts/tests/e2e/junit/**/*.xml"
      playwrightJson: "quality-artifacts/tests/e2e/playwright/**/*.json"

  coverage:
    backend:
      jacocoXml: "quality-artifacts/coverage/backend/jacoco.xml"
      jacocoCsv: "quality-artifacts/coverage/backend/jacoco.csv"
      html: "quality-artifacts/coverage/backend/html"
    frontend:
      lcov: "quality-artifacts/coverage/frontend/lcov.info"
      summaryJson: "quality-artifacts/coverage/frontend/coverage-summary.json"
      html: "quality-artifacts/coverage/frontend/html"

  requirements:
    expectedKeys: "quality-artifacts/requirements/expected.csv"
    mapping: "quality-artifacts/requirements/mapping.json"

  security:
    codeqlSarif: "quality-artifacts/security/codeql/**/*.sarif"
    zapJson: "quality-artifacts/security/zap/**/*.json"

requirements:
  keyPattern: "[A-Z]+-[0-9]+"

qualityGates:
  tests:
    allowFailed: 0
    allowBroken: 0
  coverage:
    totalMinimum: 80
    backendMinimum: 80
    frontendMinimum: 80
  requirements:
    minimum: 100
    failOnMissing: true
  security:
    maxCritical: 0
    maxHigh: 0
```

## Recommended Artifact Layout

```text
quality-artifacts/
├─ tests/
│  ├─ backend/
│  │  ├─ junit/
│  │  └─ raw/
│  ├─ frontend/
│  │  ├─ junit/
│  │  ├─ vitest/
│  │  └─ raw/
│  └─ e2e/
│     ├─ junit/
│     ├─ playwright/
│     └─ raw/
├─ coverage/
│  ├─ backend/
│  │  ├─ jacoco.xml
│  │  ├─ jacoco.csv
│  │  └─ html/
│  └─ frontend/
│     ├─ lcov.info
│     ├─ coverage-summary.json
│     └─ html/
├─ requirements/
│  ├─ expected.csv
│  └─ mapping.json
├─ security/
│  ├─ codeql/
│  └─ zap/
└─ meta/
   └─ manifest.yml
```

## External Project Setup Flow

1. Install or call the report generator.
2. Produce standard artifacts: JUnit XML, Playwright JSON or JUnit XML, JaCoCo
   XML/CSV, Istanbul/LCOV, SARIF, ZAP JSON, expected requirements CSV, and
   optional requirement mapping JSON.
3. Upload those artifacts in CI.
4. Add `quality-report.yml`.
5. Validate and generate locally:

```bash
quality-report validate --config quality-report.yml --input quality-artifacts
quality-report generate --config quality-report.yml --input quality-artifacts --output dist/report
```

6. Publish `dist/report` to GitHub Pages using the action or a reusable
   workflow.
7. Configure quality gates to match your release policy.
8. Add requirement coverage conventions to test names, tags, properties, or
   mapping files.

## Integration Examples

Java backend with Maven Surefire/Failsafe and JaCoCo:

```yaml
artifacts:
  tests:
    backend:
      junit: "quality-artifacts/tests/backend/junit/**/*.xml"
  coverage:
    backend:
      jacocoXml: "quality-artifacts/coverage/backend/jacoco.xml"
      jacocoCsv: "quality-artifacts/coverage/backend/jacoco.csv"
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
artifacts:
  security:
    codeqlSarif: "quality-artifacts/security/codeql/**/*.sarif"
```

OWASP ZAP JSON:

```yaml
artifacts:
  security:
    zapJson: "quality-artifacts/security/zap/**/*.json"
```

## Requirement Coverage

Requirement keys are extracted from test names, suites, files, JUnit properties,
Playwright annotations, labels, and explicit mapping files. Configure the key
pattern:

```yaml
requirements:
  keyPattern: "[A-Z]+-[0-9]+"
```

Expected requirements CSV:

```csv
key,title
RFL-101,Login succeeds
RFL-102,Password reset works
```

Explicit mapping JSON:

```json
[
  { "name": "auth login works", "requirement": "RFL-101" },
  { "testId": "stable-test-id", "requirement": "RFL-102" }
]
```

## Quality Gates

Default strict gates allow no failed tests, no broken tests, no critical security
findings, and no high security findings. Coverage and requirement thresholds are
enabled when configured.

```yaml
qualityGates:
  tests:
    allowFailed: 0
    allowBroken: 0
  coverage:
    totalMinimum: 80
    backendMinimum: 80
    frontendMinimum: 80
  requirements:
    minimum: 100
    failOnMissing: true
  security:
    maxCritical: 0
    maxHigh: 0
```

Failed gates return a non-zero CLI exit code, but the generator still writes a
complete static report for diagnosis.

## GitHub Pages Publishing

The generated output contains `index.html`, `404.html`, `data/manifest.json`,
test chunks such as `data/tests-0.json`, copied raw artifacts, and optionally one
current `quality-report-*.zip`. It is compatible with GitHub Pages and static
file hosting. The ZIP excludes itself to avoid recursive packaging.

## Security Model

Artifact contents are treated as untrusted. The generator normalizes data,
redacts common secrets, avoids unsafe dynamic code execution, does not embed
arbitrary third-party HTML into the main SPA, and does not send report data to
third-party services. Generated JSON and static assets should not contain
absolute runner paths such as `C:\`, `/home/`, `/mnt/`, `/Users/`, or `file://`.

## Troubleshooting

- `validate` discovers zero artifacts: check `--input` and glob paths relative
  to that input directory.
- Quality gates fail: open the generated report and inspect the gate reasons.
- Coverage is missing: confirm the configured format exists and includes total
  line, statement, or instruction metrics.
- Requirement coverage is low: check the regex, expected CSV keys, and mapping
  JSON.
- Parser warnings appear: malformed or unsupported artifact content was skipped
  without aborting report generation.
- GitHub Pages routes 404: ensure `404.html` from the generated report is
  published with `index.html`.

## Migration Strategy

Start by publishing existing JUnit and coverage artifacts without changing test
runners. Add security artifacts next, then expected requirements and explicit
mapping. Keep gates relaxed while teams baseline the data, then tighten gates by
repository or branch once reports are stable.

Developers may customize artifact paths, project metadata, requirement regexes,
quality gate thresholds, raw downloadable artifacts, ZIP output, and GitHub
Actions wiring. The generated report remains static and self-contained.

## Repository Structure

- `packages/report-core`: Zod schemas, config, normalization, requirement
  coverage, quality gates, redaction, and utilities.
- `packages/adapters`: parsers for test, coverage, requirement, and security
  artifacts.
- `packages/report-cli`: `quality-report generate`, `validate`, and `summarize`.
- `packages/report-ui`: static Vue 3 + Vite report application.
- `actions/generate-report`: GitHub Action wrapper around the CLI.
- `docs`: detailed adoption, artifact contract, configuration, gates, security,
  and troubleshooting documentation.
