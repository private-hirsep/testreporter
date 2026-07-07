# History

Milestone one writes a history-ready structure:

```json
{
  "history": {
    "runs": []
  }
}
```

The first implementation records the current run only. Later milestones should
merge previous runs before rendering the final static report.

Planned merge sources:

- GitHub Pages: download the previous published `data/manifest.json` before
  deployment and merge its `history.runs` with the current run.
- Workflow artifacts: download a previous `history.json` or report ZIP artifact
  from the same branch, release, or default branch.
- Persisted history file: accept a configured file such as
  `quality-artifacts/history/history.json` and merge it during generation.

Merge behavior should be deterministic:

- identify runs by run ID, commit SHA, or generated history ID
- keep the newest copy when duplicate IDs exist
- sort runs by `generatedAt` descending for display
- cap stored history by count or age to keep the static report small
- never require a database, API server, or external reporting service
