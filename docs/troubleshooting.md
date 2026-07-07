# Troubleshooting

## No Artifacts Found

Run:

```bash
npm run quality-report -- validate --config quality-report.yml --input quality-artifacts
```

Check that globs are relative to `--input`.

## Report UI Shows a Loading Error

Confirm `data/manifest.json` exists in the generated output and that the site is
served from a static server or GitHub Pages. Browser file loading restrictions can
block `fetch` when opening `index.html` directly from disk.

## Quality Gate Fails

Run `summarize` to see concise totals:

```bash
npm run quality-report -- summarize --config quality-report.yml --input quality-artifacts
```

## Malformed Files

Malformed artifacts are reported as parser warnings. Inspect `data/manifest.json`
for the warning list.
