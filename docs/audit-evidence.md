# Audit evidence

Each finalized report includes an evidence manifest, SHA-256 checksums, and an
immutable `quality-report.zip`. History merging and project-summary regeneration
must happen before finalization so the ZIP matches the published directory.

Retained history is mutable operational state: retention may prune it and later
trusted runs append to it. The audit ZIP is the immutable release-time snapshot:
later history persistence must not rewrite an already archived ZIP.

Verify locally with a SHA-256 tool against `checksums.sha256`, and inspect the ZIP
to confirm it contains `data/history.json`, `project-quality-summary.json`, and
`evidence-manifest.json`.
