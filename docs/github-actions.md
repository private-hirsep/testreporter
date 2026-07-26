# GitHub Actions Integration

External projects should call the canonical reusable workflow:

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
      pr-comment-marker: "<!-- quality-report-platform:summary -->"
      update-pr-comment: true
      fail-on-quality-gate: true
```

Run tests in your own jobs, upload their outputs with `actions/upload-artifact`, and let the reusable workflow consume those artifacts. The workflow generates the static report before the final gate-failure step, so report upload, Pages deploy, and PR comments can still happen for a failed gate.

## Modes

| Event               | Quality profile       | Publish mode         | PR comment mode | Fail on gate |
| ------------------- | --------------------- | -------------------- | --------------- | ------------ |
| `pull_request`      | `standard`            | `none` or `artifact` | `minimal`       | `true`       |
| `merge_group`       | `strict`              | `artifact`           | `off`           | `true`       |
| `workflow_dispatch` | `strict` or `relaxed` | `pages-and-artifact` | `off` or `full` | optional     |
| `release`           | `release`             | `pages-and-artifact` | `off`           | `true`       |
| first adoption      | `off` or `relaxed`    | `artifact`           | `minimal`       | `false`      |

The workflow resolves `publish-mode: auto` to `artifact` on pull requests and `pages-and-artifact` elsewhere. It resolves `pr-comment-mode: auto` to `minimal` on pull requests and `off` elsewhere.

## Permissions

PR comments require:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
```

Pages publishing requires:

```yaml
permissions:
  contents: read
  actions: read
  pages: write
  id-token: write
```

Fork PR comments are skipped by default. Do not move this workflow to `pull_request_target` without a security review.

## Repository self-report workflow

`.github/workflows/dogfood-quality-report.yml` is a production-style direct
self-report, not an example-artifact wrapper. It installs dependencies and
Chromium, prepares `quality-artifacts/tests/unit`,
`quality-artifacts/tests/e2e`, and `quality-artifacts/coverage`, then runs lint,
type-check, unit/coverage, build, and Playwright E2E checks.

The current report is generated before any write credential is available.
Trusted pushes to `main`/`release/**`, published releases, and trusted dispatches
continue into the isolated history job. That job merges and exactly verifies
`quality-history`, regenerates history-aware summary/evidence, finalizes the audit
ZIP, asserts `site/data/history.json`, and uploads the final Pages artifact.
Uploading is staging only. The separate deployment job calls
`actions/deploy-pages@v4`.

The pull-request workflow follows the same test setup but has `contents: read`
only, uploads a current-only report artifact, and never persists history,
publishes a central summary, or deploys Pages.

## Historical summaries and central portfolio

Use the executable examples under `examples/github-actions/`:

- `trusted-main-history.yml` and `release-history.yml` merge compact history before Pages upload;
- `project-summary-producer.yml` merges and verifies retained history, validates the regenerated
  history-aware project summary, and publishes that final summary to
  `projects/<project-key>/project-quality-summary.json` on `quality-summaries`;
- `central-portfolio-history.yml` checks out that store recursively, generates the static
  portfolio, uploads the Pages artifact, and deploys it.

Private summary repositories should use a GitHub App token where possible. Producers require
Contents write through `QUALITY_SUMMARY_WRITE_TOKEN`; consumers require Contents read through
`QUALITY_SUMMARY_READ_TOKEN`. Tokens are isolated from untrusted build jobs and never enter static
browser assets.

## Compatibility Wrapper

The old `reusable-publish-quality-report.yml` filename is kept only as a deprecated compatibility wrapper around `publish-quality-report.yml`. New consumers should use the canonical workflow directly.
