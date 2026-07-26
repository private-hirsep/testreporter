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

## History and persistence recovery

- Missing `quality-history` branch is a valid first run; the trusted persistence
  script creates an orphan branch and the `quality-history/v1` store.
- Permission denied means the isolated persistence job needs `contents: write`;
  fork pull requests must never receive it.
- Push conflicts are retried by refetching and remerging. Never force-push.
- Exact-content conflicts mean the same execution ID has different immutable
  content. Inspect with `quality-report history inspect --config quality-report.yml
  --current-report site/normalized-report.json --json`, then use a distinct
  attempt-aware ID or correct the producer.
- A project-key mismatch requires restoring the original `project.key` or starting
  a deliberately separate history store.
- Invalid history is rejected as a whole; the current report remains usable. Open
  Diagnostics and validate `quality-history/v1/index.json` plus referenced files.
- If history is absent from Pages, confirm merge ran before
  `upload-pages-artifact`, and that `site/data/history.json` exists.
- An empty report exits successfully before checkout with “No new automated or
  manual executions to persist.”
- A rejected manual execution needs `executionId`, `completedAt`, a matching
  project identity, and at least one valid completed case result.

## Summaries, portfolio, and audit recovery

- A current-only project summary is valid but cannot show trends; persist and merge
  another trusted run.
- Missing historical report links mean `project.reportUrl` was absent or changed;
  keep it stable and pass the same config to inspect, merge, and verify.
- An empty portfolio means no valid summaries were found at the configured stable
  project paths.
- Central summary authentication must be provided only to the trusted producer or
  portfolio checkout job. Verify repository, branch, token scope, and project path.
- For ZIP/checksum mismatch, regenerate the report, merge history, then run
  `quality-report finalize --output site`. Do not mutate the ZIP afterward.
- Older reports without optional history/newer fields display compatibility states;
  they must not be interpreted as zero.
