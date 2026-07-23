# Git-first execution history

Execution history is a mutable, compact operational index. It is stored in Git, merged during CI, and compiled into one static browser artifact. It is not a backend, a database, raw-result storage, or an additional source of test definitions.

## Layout and versioning

The recommended `quality-history` branch contains only:

```text
quality-history/
└── v1/
    ├── index.json
    ├── runs/<run-id>.json
    └── manual-executions/<execution-id>.json
```

`index.json` contains ordered references, project identity, retention metadata, diagnostics, and the last update. Every referenced file is independently validated. Generation compiles these files into `site/data/history.json`, so the browser performs one bounded request and never contacts GitHub APIs.

Schema version `1.0` is rejected if an unsupported version is supplied. File names contain only portable URL-safe characters. Secrets, absolute paths, logs, stack traces, attachments, and raw reports are excluded.

File names combine an 80-character readable prefix with a 12-character SHA-256 suffix of the original ID. Different IDs with the same sanitized or truncated prefix therefore cannot overwrite each other. Index references are runtime validated: run files must be relative JSON paths under `runs/`, manual files under `manual-executions/`; absolute paths, backslashes, `..`, wrong directories, duplicate paths, and ID mismatches are rejected. The store, every run, every manual execution, and the current report must have the same exact project key. A changed display name for the same key is allowed.

## Identities and timestamps

An automated report produces at most one run. Its ID is chosen deterministically:

1. explicit normalized `runId`;
2. workflow run plus attempt (`github-<run-id>-<attempt>`, defaulting to attempt 1 only when unavailable);
3. project, commit, branch, environment, and reported timestamp;
4. a deterministic technical hash.

`reportedAt` is the report-generation observation time. It is never labelled execution completion. `startedAt`, `completedAt`, and wall-clock duration are included only when genuine run-level values exist. Summed test duration is a separate metric.

Completed, valid manual executions use their validated `executionId`. Reimporting identical content keeps one record. Compatible metadata/link enrichment is merged. Conflicting immutable timestamps, status, or case results produce `HISTORY_MANUAL_CONFLICT` and retain the previous record. Drafts, browser-local drafts, invalid results, and results for non-approved cases are excluded under the existing validation rules.

## Merge and retention

```powershell
npm run quality-report -- history merge `
  --history-dir .quality-history `
  --current-report site/normalized-report.json `
  --output-dir .quality-history-next `
  --static-output site/data/history.json
```

No history directory is required on the first run. Input discovery order does not affect output. Identical runs are idempotent; conflicting duplicate IDs are diagnosed and not overwritten. Output is written to a sibling temporary directory and renamed only after every artifact validates; the previous directory is temporarily backed up and restored if replacement fails.

Conservative defaults are:

```yaml
history:
  enabled: true
  maxRuns: 50
  maxAgeDays: 180
  maxManualExecutions: 200
  stability:
    minimumSamples: 5
    flakyTransitionThreshold: 2
  duration:
    minimumSamples: 3
    regressionPercent: 30
    minimumIncreaseMs: 500
```

Automated and manual limits are applied independently. Newest items are retained deterministically, the current run is never pruned, and removed files never remain referenced. Pruning is recorded as an informational diagnostic. Fifty runs with 5,000 compact case snapshots is normally tens of megabytes rather than the much larger raw reports; projects should lower limits when Git growth is undesirable.

## Comparison and trend semantics

Automated implementation variants are aggregated once per logical case per run using the existing worst-state order. A manual result is one sample per execution. Retries, variants, absent results, and repeated imports are not additional historical executions. Automated comparison streams record explicit `present` or `absent` samples. A previously present case absent from the latest comparable run is `removed-or-missing`; absence is never pass, failure, skip, not-run, or recovery. `not-executed` is reserved for an explicit `not-run` result.

By default, comparisons require the same project, execution type, branch, and environment:

- newly failing: current failed/broken after a comparable non-failing state;
- first observed failing: current failed/broken without a prior comparable sample;
- persistently failing: current and previous comparable states failed/broken;
- recovered: failed/broken followed by passed;
- newly/still blocked: blocked after non-blocked / blocked;
- new case: first observed non-failing case;
- removed or missing: previously observed but absent; absence is never pass, failure, or recovery.

Historical instability requires the configured sample minimum, both pass and fail observations, enough pass/fail transitions, compatible streams, and a non-conflicted identity. An in-run retry pass is labelled separately. Generated IDs show lower-confidence continuity; renames are never inferred. Conflicted identities expose raw records but no trusted pass rate or stability claim.

Case duration is summed implementation time within an automated run, clearly labelled as such; it is not wall-clock time. Invalid and missing values are ignored. A slow regression requires the configured sample count and both the percentage and absolute increase thresholds.

One retained run produces “One execution is available. More executions are required for trends.” No history produces “Historical execution summaries have not been imported for this report.” No synthetic points are generated.

## Trusted persistence and concurrency

See `examples/github-actions/` for complete main, pull-request, release, and portfolio examples.

The write job is restricted to trusted `push`, `release`, or explicitly trusted dispatch events. Fork pull requests may read a published history artifact but never receive `contents: write`. The checkout used to execute project code has `persist-credentials: false`; no untrusted code runs after a write-capable token is available.

Use:

```yaml
concurrency:
  group: quality-history-${{ github.repository }}
  cancel-in-progress: false
```

The operational order is: generate current data, initialize or load history, merge, write `site/data/history.json`, rewrite the project summary with derived metrics, upload the final Pages artifact, and persist the compact branch. Before every commit attempt, fetch the latest branch and rerun the merge against it. Rebasing a precomputed history commit is insufficient.

Before committing, fetch the latest `quality-history` branch, merge again, and commit only changed compact files. Push normally—never force-push. On non-fast-forward failure, refetch and repeat the merge a bounded number of times. Failure to initialize or persist history must warn but need not fail report publication. Protect the history branch against deletion and force pushes while allowing the dedicated trusted job to update it.

## Audit and privacy

The history branch is mutable operational trend data. A release audit package is an immutable evidence snapshot. If an audit package includes historical context, it must copy and label that context, record its checksum, and never reference mutable branch content as immutable evidence.

History deliberately excludes raw stack traces, logs, screenshots, attachments, tokens, absolute paths, and private environment values. A full report or evidence link is optional; unavailable links are shown honestly.

Older reports and project summaries remain valid. Their overview, case detail, executions, and portfolio pages show current data with explicit history-unavailable states.

The browser loads the manifest and current test chunks before loading history independently. Missing history gives the normal unavailable state. Invalid JSON, unsupported versions, or fetch failures become focused diagnostics without replacing the current report with an application-wide error.

## Requirement-history scope

PR #28 provides project-level and logical test-case history only. Requirement-level state
transitions are deliberately deferred to a follow-up because the compact run contract does not yet
retain the release-scope membership and evidence-source snapshots required to distinguish covered,
uncovered, excluded, and not-in-scope states honestly. The Requirements page continues to show the
current report’s real traceability data and does not claim that requirement history is available.
Adding requirement history requires a versioned additive snapshot contract and scope-compatible
comparison tests; it must not infer requirement transitions from aggregate counts.

## Recovery

If a merge fails validation, keep the previous branch unchanged and correct the focused diagnostic. If the branch is absent, initialize an orphan branch containing only `quality-history/v1`. If concurrent pushes repeatedly fail, publish the report, retain the generated next store as an artifact, warn that persistence did not complete, and rerun the trusted job.
