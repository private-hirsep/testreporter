# GitHub Actions Integration

## Composite action

```yaml
- uses: your-org/quality-report-platform/actions/generate-report@v1
  with:
    config-path: quality-report.yml
    input-path: quality-artifacts
    output-path: dist/report
    quality-profile: standard
```

The action writes:

- `data/manifest.json`
- `meta/quality-summary.json`
- `meta/pr-comment-minimal.md`
- `meta/pr-comment-full.md`

## Reusable workflow

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: "quality-*"
      quality-profile: standard
      publish-mode: auto
      pr-comment-mode: auto
```

Inputs:

- `publish-mode`: `auto`, `none`, `artifact`, `pages`, `pages-and-artifact`
- `pr-comment-mode`: `auto`, `off`, `minimal`, `full`
- `update-pr-comment`: defaults to `true` and updates the bot comment containing
  `<!-- quality-report-platform:summary -->`
- `fail-on-quality-gate`: defaults to `true`, but failure happens after report
  generation, artifact upload, Pages deploy, and PR comment steps.

`auto` resolves as:

| Event | Publish mode | PR comment mode |
|---|---|---|
| `pull_request` | `none` | `minimal` |
| `merge_group` | `artifact` | `off` |
| `workflow_dispatch` | `pages-and-artifact` | `off` |
| `release` | `pages-and-artifact` | `off` |
| `push` to default branch | `pages-and-artifact` | `off` |

Common setups:

```yaml
# PR minimal comment only
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

```yaml
# PR full comment with downloadable artifact
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
      publish-mode: artifact
      pr-comment-mode: full
      fail-on-quality-gate: true
```

```yaml
# Manual full Pages publish
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    permissions:
      contents: read
      actions: read
      pages: write
      id-token: write
    with:
      artifact-pattern: quality-*
      quality-profile: strict
      publish-mode: pages-and-artifact
      pr-comment-mode: off
      fail-on-quality-gate: false
```

```yaml
# Release full Pages publish
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    permissions:
      contents: read
      actions: read
      pages: write
      id-token: write
    with:
      artifact-pattern: quality-*
      quality-profile: release
      publish-mode: pages-and-artifact
      pr-comment-mode: off
      fail-on-quality-gate: true
```

```yaml
# Report-only adoption mode
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
      quality-profile: off
      publish-mode: artifact
      pr-comment-mode: minimal
      fail-on-quality-gate: false
```

Use combined permissions when both Pages and PR comments are enabled:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: read
  pages: write
  id-token: write
```

The workflow exposes `quality-gate-status`, `quality-profile`, `report-path`,
`report-zip-path`, `pages-url`, `pr-comment-url`, `summary-json-path`,
`minimal-comment-path`, and `full-comment-path`.
