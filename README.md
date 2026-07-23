# Quality Report Platform

The report UI is a consistent QA workspace — navigation, status semantics, and responsive behavior are documented in [docs/user-interface.md](docs/user-interface.md).

Release readiness, Git definition history, audit evidence, and multi-project portfolio generation are documented in [docs/release-readiness.md](docs/release-readiness.md).

Stable test identity and traceability are documented in [docs/test-identity.md](docs/test-identity.md). Explicit IDs are optional; all automated results remain imported automatically.

Quality Report Platform generates a static CI Quality Portal from artifacts your workflow already produced.

Your CI runs tests however it wants. Your CI uploads standard artifacts. The Quality Portal workflow downloads those artifacts, generates a static report, optionally uploads a report ZIP, deploys GitHub Pages, comments on pull requests, and fails on quality gates.

## What This Project Does

- Generates a static GitHub Pages-compatible report with no backend runtime.
- Parses common test, coverage, requirement, security, and raw evidence artifacts.
- Evaluates quality gates through built-in or custom quality profiles.
- Writes PR comment markdown and can post or update PR comments from the reusable workflow.
- Produces `data/manifest.json`, `meta/quality-summary.json`, PR comment files, raw downloads, and an optional `quality-report.zip`.
- Preserves raw evidence as downloadable files instead of embedding arbitrary third-party HTML in the SPA.

## What This Project Does Not Do

- It does not run tests by default.
- It does not replace Maven, Gradle, npm, pnpm, yarn, Pytest, Vitest, Playwright, CodeQL, ZAP, or your existing CI jobs.
- It does not require a backend, database, token broker, or server-side renderer.
- It does not require one CI folder layout, build system, container image, or test runner.
- It does not upload report data to external services.

## Supported Artifact Types

| Area         | Supported formats                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests        | JUnit XML, Pytest JUnit XML through the JUnit parser, Maven Surefire/Failsafe XML, Vitest JSON, Vitest JUnit XML through the JUnit parser, Playwright JSON, Playwright JUnit XML through the JUnit parser |
| Coverage     | JaCoCo XML, JaCoCo CSV, LCOV, Istanbul `coverage-summary.json`, Cobertura XML                                                                                                                             |
| Requirements | Expected requirements CSV, requirement mapping JSON, requirement keys discovered from test names                                                                                                          |
| Security     | CodeQL/SARIF, OWASP ZAP JSON                                                                                                                                                                              |
| Downloads    | Raw configured artifacts, copied static HTML reports, generated report ZIP                                                                                                                                |

Structured artifacts larger than 50 MiB are skipped with parser warnings.

## Quick Start

1. Run your normal CI jobs.
2. Upload their outputs with `actions/upload-artifact`.
3. Add `quality-report.yml` with globs matching the downloaded artifact contents.
4. Call `.github/workflows/publish-quality-report.yml` as the final job.

Minimal local check after building this repository:

```bash
npm install
npm run build
npm run quality-report -- validate --config examples/minimal/quality-report.yml --input examples/minimal/quality-artifacts
npm run quality-report -- generate --config examples/minimal/quality-report.yml --input examples/minimal/quality-artifacts --output dist/example-report --zip
```

## Minimal External Workflow

This example assumes earlier jobs upload artifacts whose names match `quality-*` and whose merged contents match `quality-report.yml`.

```yaml
name: Quality

on:
  pull_request:

permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./ci/test-and-write-artifacts.sh
      - uses: actions/upload-artifact@v4
        with:
          name: quality-artifacts
          path: quality-artifacts

  quality-report:
    needs: test
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      artifact-path: quality-artifacts
      config-path: quality-report.yml
      quality-profile: standard
      publish-mode: none
      pr-comment-mode: minimal
      fail-on-quality-gate: true
```

## Common Workflow Modes

| Mode                             | Recommended inputs                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PR minimal comment only          | `quality-profile: standard`, `publish-mode: none`, `pr-comment-mode: minimal`, `fail-on-quality-gate: true`                        |
| PR minimal comment plus artifact | `quality-profile: standard`, `publish-mode: artifact`, `pr-comment-mode: minimal`, `fail-on-quality-gate: true`                    |
| Manual full report publish       | `quality-profile: strict`, `publish-mode: pages-and-artifact`, `pr-comment-mode: off`, `fail-on-quality-gate: false` while testing |
| Release full report publish      | `quality-profile: release`, `publish-mode: pages-and-artifact`, `pr-comment-mode: off`, `fail-on-quality-gate: true`               |
| Merge queue strict check         | `quality-profile: strict`, `publish-mode: artifact`, `pr-comment-mode: off`, `fail-on-quality-gate: true`                          |
| First adoption report-only       | `quality-profile: off` or `relaxed`, `publish-mode: artifact`, `pr-comment-mode: minimal`, `fail-on-quality-gate: false`           |

Pull requests should usually use `pr-comment-mode: minimal`.

## Quality Profiles

The canonical reusable workflow calls the CLI, so these are the CLI's current built-in profile values.

| Profile    | Purpose                           | Failed tests | Broken tests | Total coverage | Backend coverage | Frontend coverage | Requirement coverage | Missing reqs | Extra reqs |  Critical |      High |    Medium |  Warnings |
| ---------- | --------------------------------- | -----------: | -----------: | -------------: | ---------------: | ----------------: | -------------------: | ------------ | ---------- | --------: | --------: | --------: | --------: |
| `off`      | Report-only adoption              |    <= 999999 |    <= 999999 |        skipped |          skipped |           skipped |              skipped | allowed      | allowed    | <= 999999 | <= 999999 | <= 999999 | <= 999999 |
| `relaxed`  | Early adoption and noisy projects |         <= 3 |         <= 2 |         >= 60% |          skipped |           skipped |               >= 60% | allowed      | allowed    |         0 |      <= 5 |     <= 10 |     <= 20 |
| `standard` | Normal pull request default       |            0 |            0 |         >= 70% |          skipped |           skipped |               >= 75% | allowed      | allowed    |         0 |         0 |      <= 3 |     <= 10 |
| `strict`   | Merge queue and mature branches   |            0 |            0 |         >= 85% |           >= 85% |            >= 80% |               >= 90% | fail         | fail       |         0 |         0 |         0 |         0 |
| `release`  | Release readiness                 |            0 |            0 |         >= 90% |           >= 90% |            >= 85% |                 100% | fail         | fail       |         0 |         0 |         0 |         0 |

`custom` is not a magic built-in. It works only if a `qualityGateProfiles.custom` profile exists in `quality-report.yml` or in the file passed through `--quality-gates` / `quality-gates-path`. Unknown profiles fail validation with an "Unknown quality profile" error.

## Custom `quality-gates.yml`

The external gates file can provide direct `qualityGates` overrides and named `qualityGateProfiles`. Current CLI profile definitions are direct profile objects; profile `extends` chains are not implemented in the workflow path.

```yaml
qualityGateProfiles:
  pr:
    tests:
      allowFailed: 0
      allowBroken: 0
    coverage:
      totalMinimum: 70
    requirements:
      minimum: 75
      failOnMissing: false
      failOnExtra: false
    security:
      maxCritical: 0
      maxHigh: 0
      maxMedium: 3
    warnings:
      maxWarnings: 10

  merge-queue:
    tests:
      allowFailed: 0
      allowBroken: 0
    coverage:
      totalMinimum: 85
      backendMinimum: 85
      frontendMinimum: 80
    requirements:
      minimum: 90
      failOnMissing: true
      failOnExtra: true
    security:
      maxCritical: 0
      maxHigh: 0
      maxMedium: 0
    warnings:
      maxWarnings: 0

  release:
    tests:
      allowFailed: 0
      allowBroken: 0
    coverage:
      totalMinimum: 90
      backendMinimum: 90
      frontendMinimum: 85
    requirements:
      minimum: 100
      failOnMissing: true
      failOnExtra: true
    security:
      maxCritical: 0
      maxHigh: 0
      maxMedium: 0
    warnings:
      maxWarnings: 0
```

## Publish Modes

The reusable workflow resolves `auto` before calling the CLI.

| Mode                 | Generates report | Uploads workflow artifact | Deploys Pages       | Recommended for                                   |
| -------------------- | ---------------- | ------------------------- | ------------------- | ------------------------------------------------- |
| `auto`               | yes              | PRs yes, non-PRs yes      | PRs no, non-PRs yes | Default reusable workflow behavior                |
| `none`               | yes              | no                        | no                  | PR comment only                                   |
| `artifact`           | yes              | yes                       | no                  | PRs, merge queue                                  |
| `pages`              | yes              | no                        | yes                 | Manual, main, release when ZIP is not needed      |
| `pages-and-artifact` | yes              | yes                       | yes                 | `workflow_dispatch`, release, trusted main branch |

## PR Comment Modes

| Mode      | Behavior                                                    |
| --------- | ----------------------------------------------------------- |
| `auto`    | Resolves to `minimal` on `pull_request`, otherwise `off`    |
| `off`     | Does not post a PR comment                                  |
| `minimal` | Posts the compact summary from `meta/pr-comment-minimal.md` |
| `full`    | Posts the detailed summary from `meta/pr-comment-full.md`   |

PR comments update in place by default through `update-pr-comment: true`. The workflow searches bot comments for the hidden marker `<!-- quality-report-platform:summary -->`. Fork PR comments are skipped by default because the workflow only comments when the pull request head repository is the same repository.

## Event Recommendations

| Event               | Quality profile        | Publish mode         | PR comment mode | Fail on gate |
| ------------------- | ---------------------- | -------------------- | --------------- | ------------ |
| `pull_request`      | `standard`             | `none` or `artifact` | `minimal`       | `true`       |
| `merge_group`       | `strict`               | `artifact` or `none` | `off`           | `true`       |
| `workflow_dispatch` | `strict` or `relaxed`  | `pages-and-artifact` | `off` or `full` | optional     |
| `release`           | `release`              | `pages-and-artifact` | `off`           | `true`       |
| push to main        | `standard` or `strict` | `pages-and-artifact` | `off`           | `true`       |
| first adoption      | `off` or `relaxed`     | `artifact`           | `minimal`       | `false`      |

## Required Permissions

PR comment only:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
```

Pages publish:

```yaml
permissions:
  contents: read
  actions: read
  pages: write
  id-token: write
```

Both:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
  pages: write
  id-token: write
```

The canonical reusable workflow declares all of these permissions because it supports comments, artifacts, and Pages from one workflow. Caller workflows should grant only the permissions needed for the selected mode.

## Artifact Layout

This layout is recommended, not mandatory. Paths are configurable through `quality-report.yml`.

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

## Minimal `quality-report.yml`

Globs are resolved relative to `--input` or the reusable workflow's `artifact-path`.

```yaml
project:
  name: Example Service
  repository: your-org/example-service

artifacts:
  tests:
    backend:
      junit: "tests/backend/junit/**/*.xml"
      pytestJunit: "tests/backend/pytest/**/*.xml"
    frontend:
      junit: "tests/frontend/junit/**/*.xml"
      vitestJson: "tests/frontend/vitest/**/*.json"
    e2e:
      junit: "tests/e2e/junit/**/*.xml"
      playwrightJson: "tests/e2e/playwright/**/*.json"
  coverage:
    backend:
      jacocoXml: "coverage/backend/jacoco.xml"
      jacocoCsv: "coverage/backend/jacoco.csv"
      coberturaXml: "coverage/backend/cobertura.xml"
      html: "coverage/backend/html"
    frontend:
      lcov: "coverage/frontend/lcov.info"
      summaryJson: "coverage/frontend/coverage-summary.json"
      coberturaXml: "coverage/frontend/cobertura.xml"
      html: "coverage/frontend/html"
  requirements:
    expectedKeys: "requirements/expected.csv"
    mapping: "requirements/mapping.json"
  security:
    codeqlSarif: "security/codeql/**/*.sarif"
    zapJson: "security/zap/**/*.json"
  raw:
    - "tests/**/raw/**"

requirements:
  keyPattern: "[A-Z]+-[0-9]+"
```

## CLI Usage

Build before running `npm run quality-report`, because the root script points at `packages/report-cli/dist/index.js`.

```bash
npm run build

npm run quality-report -- validate --config examples/minimal/quality-report.yml --input examples/minimal/quality-artifacts

npm run quality-report -- generate \
  --config examples/minimal/quality-report.yml \
  --quality-gates examples/minimal/quality-gates.yml \
  --input examples/minimal/quality-artifacts \
  --output dist/example-report \
  --quality-profile relaxed \
  --publish-mode artifact \
  --pr-comment-mode minimal \
  --zip
```

Commands:

| Command     | Purpose                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `validate`  | Parses config, applies optional quality profile, discovers artifacts, and warns when nothing matched |
| `summarize` | Generates a temporary report summary and exits non-zero when the gate fails                          |
| `generate`  | Writes the static report, metadata, PR comment files, raw downloads, and optional ZIP                |

## Reusable Workflow Inputs

Canonical reusable workflow: `.github/workflows/publish-quality-report.yml`.

| Input                  | Required | Default                                    | Allowed values                                            | Description                                                         |
| ---------------------- | -------- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `artifact-pattern`     | no       | `quality-*`                                | artifact name pattern                                     | Pattern passed to `actions/download-artifact`                       |
| `artifact-path`        | no       | `quality-artifacts`                        | path                                                      | Directory where artifacts are merged                                |
| `config-path`          | no       | `quality-report.yml`                       | path                                                      | Config file in the caller repository                                |
| `quality-gates-path`   | no       | empty                                      | path                                                      | Optional external gate/profile file                                 |
| `quality-profile`      | no       | `standard`                                 | built-in or custom profile name                           | Profile selected for validation and generation                      |
| `publish-mode`         | no       | `auto`                                     | `auto`, `none`, `artifact`, `pages`, `pages-and-artifact` | Delivery mode                                                       |
| `pr-comment-mode`      | no       | `auto`                                     | `auto`, `off`, `minimal`, `full`                          | PR comment mode                                                     |
| `pr-comment-marker`    | no       | `<!-- quality-report-platform:summary -->` | HTML comment marker                                       | Marker used for update-in-place lookup                              |
| `update-pr-comment`    | no       | `true`                                     | `true`, `false`                                           | Update an existing marked bot comment instead of creating a new one |
| `fail-on-quality-gate` | no       | `true`                                     | `true`, `false`                                           | Fail the workflow after delivery steps when the gate failed         |
| `report-title`         | no       | empty                                      | string                                                    | Reserved for future report title overrides                          |

## Reusable Workflow Outputs

| Output                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `quality-gate-status`  | Final gate status from `meta/quality-summary.json`         |
| `quality-profile`      | Selected quality profile input                             |
| `report-path`          | Generated static report directory, currently `dist/report` |
| `report-zip-path`      | Generated ZIP path                                         |
| `pages-url`            | GitHub Pages URL when Pages was deployed                   |
| `pr-comment-url`       | Created or updated PR comment URL                          |
| `summary-json-path`    | `dist/report/meta/quality-summary.json`                    |
| `minimal-comment-path` | `dist/report/meta/pr-comment-minimal.md`                   |
| `full-comment-path`    | `dist/report/meta/pr-comment-full.md`                      |

The deprecated `reusable-publish-quality-report.yml` file is a compatibility wrapper only. New consumers should use `publish-quality-report.yml`.

## Dogfood Workflow

`Dogfood Quality Report` uploads `examples/minimal/quality-artifacts` as `quality-dogfood-artifacts`, then calls the canonical reusable workflow exactly like an external project would.

Maintainers can run it through `workflow_dispatch` and choose `quality-profile`, `publish-mode`, and `pr-comment-mode`. Pull requests use `relaxed`, `artifact`, `minimal`, and `fail-on-quality-gate: false`. Pushes to `main` use `relaxed`, `artifact`, and comments off. Manual runs can test `pages-and-artifact`, `full` comments, strict profiles, and final gate failure.

## Troubleshooting

| Problem                                   | Check                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Generated report shows old UI             | Run `npm run build`; the CLI copies `packages/report-ui/dist` when available                                                      |
| Pages deploy succeeds but page is blank   | Confirm `data/manifest.json` exists and Pages serves the extracted report directory, not only the ZIP                             |
| Pages report not visible                  | Confirm repository Pages is enabled and permissions include `pages: write` plus `id-token: write`                                 |
| PR comment not posted                     | Use a `pull_request` event, `pr-comment-mode: minimal` or `full`, same-repository PR, and comment permissions                     |
| PR comment duplicated                     | Keep the same marker and `update-pr-comment: true`; only bot comments containing the marker are updated                           |
| Workflow cannot download artifacts        | Confirm `artifact-pattern` matches uploaded artifact names and `actions: read` is granted                                         |
| No artifacts matched pattern              | Run `validate`; globs in `quality-report.yml` are relative to `artifact-path` / `--input`                                         |
| Quality gate failed before upload/comment | The reusable workflow fails on gates after delivery; earlier failures are config, artifact, build, permission, or deploy failures |
| Report ZIP missing                        | The canonical workflow always passes `--zip`; local generation needs `--zip`                                                      |
| Absolute paths found in output            | Report it; generator paths should be scrubbed to relative labels or `[path]`                                                      |
| Strict profile fails example data         | Expected for the sample strict smoke test                                                                                         |
| Fork PR comments are skipped              | Expected fork-safety behavior                                                                                                     |
| Missing permissions for Pages or comments | Add the permissions shown above for the selected publish/comment mode                                                             |

## Security Model

- Artifacts are treated as untrusted parser input.
- Parser input is size-limited and malformed files become warnings or controlled errors.
- Raw third-party HTML is copied as downloads and is not embedded in the SPA.
- Markdown comments escape user-controlled values.
- Secret-like values and absolute paths are redacted or scrubbed where feasible.
- Workflows use least-privilege permissions for the selected mode.
- The generated report is static and does not require external services, a database, or a backend runtime.

## Local Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run check:workflows-docs
npm run quality-report -- generate --config examples/minimal/quality-report.yml --quality-gates examples/minimal/quality-gates.yml --input examples/minimal/quality-artifacts --output dist/example-report --quality-profile relaxed --zip
npm run clean
```

The dogfood workflow depends on GitHub Actions features such as artifact download, PR comments, and Pages deployment, so it cannot be fully exercised locally. Use the CLI for local report generation and `workflow_dispatch` for end-to-end workflow delivery checks.

## More Documentation

- [Artifact contract](docs/artifact-contract.md)
- [Configuration](docs/configuration.md)
- [Supported formats](docs/supported-formats.md)
- [Requirement coverage](docs/requirement-coverage.md)
- [Quality gates](docs/quality-gates.md)
- [GitHub Actions integration](docs/github-actions.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Security model](docs/security.md)
- [Local development](docs/local-development.md)
