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

## PR Comments Look Over-Escaped

Regenerate with the current CLI and inspect `meta/pr-comment-minimal.md`. Inline
code should look like `backend.user.Test > handles JIRA-123`, not
`backend\.user\.Test`. If it is still over-escaped, confirm the reusable workflow
is using the same ref as the updated platform code.

## PR Comment Is Duplicated Instead of Updated

The default `update-pr-comment: true` updates an existing bot comment containing
the hidden marker. Duplicates usually mean the marker was changed, the previous
comment was created by a different account, or `update-pr-comment` was set to
`false`.

## No PR Comment Appears

Confirm the run has pull request context, `pr-comment-mode` resolves to `minimal`
or `full`, and the caller grants:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
```

Without `issues: write` and `pull-requests: write`, the GitHub API cannot create
or update the pull request comment.

## Pages Report Is Not Published

Confirm `publish-mode` resolves to `pages` or `pages-and-artifact` and the caller
grants:

```yaml
permissions:
  contents: read
  actions: read
  pages: write
  id-token: write
```

For pull requests, `publish-mode: auto` resolves to `none` by default.

## Quality Gate Failed Before Report Was Uploaded

The reusable workflow runs generation, upload/deploy, and comment steps before
the final quality gate failure step. If a workflow fails earlier, inspect the
failing step name. Parser/config errors, missing permissions, or artifact upload
errors can still stop the workflow before the final gate step.
