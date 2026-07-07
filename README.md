# Quality Report Platform

An organization-wide Testing Bible and Quality Portal for static test, coverage,
requirements, and security reporting from CI artifacts.

Milestone one focuses on a reusable artifact-based static report generator. It
does not dictate how projects run tests. Projects keep their own Maven, Gradle,
npm, pnpm, yarn, Pytest, Vitest, Playwright, CodeQL, ZAP, or custom workflows and
publish standard artifacts that this platform normalizes into one report model.

## Architecture

The platform is an npm workspace monorepo:

- `packages/report-core`: Zod schemas, config loading, normalization,
  deduplication, requirement coverage, quality gates, redaction, and utilities.
- `packages/adapters`: framework-independent parsers for JUnit XML, Playwright
  JSON, Vitest JSON, JaCoCo, LCOV, Istanbul, Cobertura, SARIF, and ZAP JSON.
- `packages/report-cli`: `quality-report` CLI for `generate`, `validate`, and
  `summarize`.
- `packages/report-ui`: static Vue 3 + Vite + Vuetify report application.
- `actions/generate-report`: GitHub Action wrapper around the CLI.
- `docs`: adoption, artifact contract, configuration, gates, security, and
  troubleshooting documentation.

The generator flow is:

1. Load `quality-report.yml`.
2. Discover configured artifact files.
3. Parse supported formats through adapters.
4. Normalize into the platform schema.
5. Deduplicate repeated test results and retries.
6. Evaluate requirement coverage and quality gates.
7. Write chunked static JSON under `data/`.
8. Build/copy the static UI.
9. Copy allowed raw reports as downloadable static assets.
10. Optionally create `quality-report.zip`.

The generated report is a static SPA and works on GitHub Pages without a server,
database, SSR runtime, or external service.

## Quick Start

```bash
npm install
npm run build
npm run quality-report -- generate \
  --config examples/minimal/quality-report.yml \
  --input examples/minimal/quality-artifacts \
  --output dist/example-report
```

Open `dist/example-report/index.html` or publish `dist/example-report` to GitHub
Pages.

## Example GitHub Action

```yaml
- uses: your-org/quality-report-platform/actions/generate-report@v1
  with:
    config-path: quality-report.yml
    input-path: quality-artifacts
    output-path: dist/report
```

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
