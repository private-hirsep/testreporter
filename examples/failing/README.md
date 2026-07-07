# Failing Quality Example

This sample reuses the artifacts from `examples/minimal/quality-artifacts` with
strict thresholds that intentionally fail.

```bash
npm run quality-report -- generate \
  --config examples/failing/quality-report.yml \
  --input examples/minimal/quality-artifacts \
  --output dist/failing-report
```

Expected result: the generated report is still produced, but the CLI exits with a
failed quality gate because the sample contains a failed test, incomplete
requirement coverage, and coverage below the configured failing threshold.
