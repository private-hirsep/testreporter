# Getting Started

1. Keep your existing CI jobs for tests, coverage, security scans, and requirement checks.
2. Upload their outputs with `actions/upload-artifact`.
3. Add `quality-report.yml` to describe the artifact paths.
4. Run the CLI locally to validate the config.
5. Call the canonical reusable workflow from CI.

```bash
npm install
npm run build
npm run quality-report -- validate --config quality-report.yml --input quality-artifacts
npm run quality-report -- generate --config quality-report.yml --input quality-artifacts --output dist/report --zip
```

When `--zip` is used, the generated ZIP is added to the Downloads section and can also be uploaded as a workflow artifact.

The project is report-from-artifacts. It does not require a specific test runner, build tool, Docker image, or artifact layout.
