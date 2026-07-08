# Getting Started

1. Produce standard CI artifacts from your existing test workflows.
2. Add `quality-report.yml` to describe where those artifacts live.
3. Run the CLI locally.
4. Publish the generated static directory to GitHub Pages.

```bash
npm install
npm run build
npm run quality-report -- validate --config quality-report.yml --input quality-artifacts
npm run quality-report -- generate --config quality-report.yml --input quality-artifacts --output dist/report --zip
```

When `--zip` is used, the generated ZIP is added to the Downloads section and can
also be uploaded as a workflow artifact.

The first milestone is report-from-artifacts only. Keep your project-specific
test execution workflow and upload artifacts in the formats documented here.
