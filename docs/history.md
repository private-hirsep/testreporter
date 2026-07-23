# History

The generated manifest contains a history-ready structure with the current run:

```json
{
  "history": {
    "runs": [
      {
        "generatedAt": "2026-07-08T00:00:00.000Z",
        "qualityGateStatus": "passed"
      }
    ]
  }
}
```

The current implementation records only the current run. It does not yet merge previous GitHub Pages deployments, previous workflow artifacts, or external history files. In the report UI this data backs the **Executions** page (route `#/history`), which states explicitly when only the current run is available instead of rendering a single-run trend.
