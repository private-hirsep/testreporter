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

## Compatibility Wrapper

The old `reusable-publish-quality-report.yml` filename is kept only as a deprecated compatibility wrapper around `publish-quality-report.yml`. New consumers should use the canonical workflow directly.
