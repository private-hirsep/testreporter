# GitHub Actions Integration

The recommended integration is the reusable workflow:

```yaml
# PR minimal comment only
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      artifact-path: quality-artifacts
      config-path: quality-report.yml
      quality-gates-path: quality-gates.yml
      quality-profile: standard
      publish-mode: artifact
      pr-comment-mode: minimal
      pr-comment-marker: "<!-- quality-report-platform:summary -->"
      update-pr-comment: true
      fail-on-quality-gate: true
```

Run tests in your own jobs, upload their outputs with `actions/upload-artifact`, and let the reusable workflow consume those artifacts. The workflow generates the static report before it evaluates the final failure condition, so artifacts, Pages deployments, and PR comments can still be produced for failing gates.

Use `publish-mode: none` or `artifact` on PRs. Use `pages-and-artifact` for manual dispatch, releases, or trusted main-branch publishing. PR comments require `issues: write` and `pull-requests: write`, and use `<!-- quality-report-platform:summary -->` for update-in-place lookup. Fork PR comments are skipped by default; do not use `pull_request_target` without a security review. Pages publishing requires `pages: write` and `id-token: write`.

The old `reusable-publish-quality-report.yml` filename is kept only as a compatibility wrapper. New consumers should use `publish-quality-report.yml`.
