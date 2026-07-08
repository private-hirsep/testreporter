# Troubleshooting

## Generated Report Shows Old UI

Run `npm run build` before `npm run quality-report`. The CLI copies `packages/report-ui/dist` when it exists; otherwise it writes a fallback page that says the UI was not built.

## Pages Deploy Succeeds But The Page Is Blank

Confirm the Pages artifact contains the extracted report directory with `index.html` and `data/manifest.json`. Do not deploy only `quality-report.zip`.

## Pages Report Is Not Visible

Use `publish-mode: pages` or `pages-and-artifact`, enable GitHub Pages for the repository, and grant:

```yaml
permissions:
  contents: read
  actions: read
  pages: write
  id-token: write
```

## PR Comment Is Not Posted

Comments only run on `pull_request`, only when `pr-comment-mode` resolves to `minimal` or `full`, and only for same-repository PRs. Grant:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
```

Fork PR comments are skipped by default.

## PR Comment Is Duplicated

Keep `update-pr-comment: true` and keep the same hidden marker:

```yaml
pr-comment-marker: "<!-- quality-report-platform:summary -->"
```

The workflow updates only comments created by `github-actions[bot]` that contain the marker.

## Workflow Cannot Download Artifacts

The canonical workflow uses `actions/download-artifact@v4` with `if-no-artifacts-found: error`. Check that producing jobs uploaded artifacts before the report job, the report job has `needs` dependencies, and `artifact-pattern` matches artifact names.

## No Artifacts Matched The Config

Run:

```bash
npm run quality-report -- validate --config quality-report.yml --input quality-artifacts
```

Globs in `quality-report.yml` are relative to `--input` or the reusable workflow's `artifact-path`.

## Quality Gate Failed Before Upload Or Comment

The reusable workflow runs the final gate failure after generation, ZIP upload, Pages deploy, and PR comment steps. If the run stopped earlier, inspect the failed step. Common causes are invalid config, missing artifacts, `npm run build` failure, missing permissions, or Pages deployment errors.

## Report ZIP Missing

The canonical reusable workflow passes `--zip` and fails if no `quality-report*.zip` exists. Local generation creates the ZIP only when `--zip` is passed.

## Absolute Paths Found In Output

Generated source labels should be relative to the artifact input directory or scrubbed to `[path]`. If an absolute path appears in `data/manifest.json`, `meta/*.md`, or PR comments, treat it as a bug.

## Strict Profile Fails Example Data

Expected. CI intentionally generates a strict sample report and asserts that its quality gate fails.

## Missing Permissions

Use the smallest permission block for the selected mode. PR comments need `issues: write` and `pull-requests: write`; Pages needs `pages: write` and `id-token: write`.
