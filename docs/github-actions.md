# GitHub Actions Integration

Composite action:

```yaml
- uses: your-org/quality-report-platform/actions/generate-report@v1
  with:
    config-path: quality-report.yml
    input-path: quality-artifacts
    output-path: dist/report
```

Optional reusable workflow:

```yaml
jobs:
  quality-report:
    uses: your-org/quality-report-platform/.github/workflows/publish-quality-report.yml@v1
    with:
      artifact-pattern: quality-*
      config-path: .github/quality-report.yml
      deploy-pages: true
```

The reusable workflow downloads artifacts, generates the static report, uploads a
Pages artifact, optionally deploys Pages, and uploads the report ZIP. It does not
dictate how tests are executed.
