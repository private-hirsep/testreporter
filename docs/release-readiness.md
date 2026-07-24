# Release readiness, audit evidence, and portfolios

The generator remains static and Git-first. No backend, account, Jira token, database, or browser access to private repositories is required.

## Release scope

Configure `release.scope` relative to `quality-report.yml`, or pass `--release-scope`. YAML and JSON use the same contract:

```yaml
release: 1.1.7
requirements: [REQ-123, REQ-187]
requiredManualCases: [MANUAL-0012]
excludedRequirements:
  - id: REQ-199
    reason: Deferred from this release
acceptedRisks:
  - id: RISK-004
    reason: Low-severity dependency finding accepted for 1.1.7
    reference: ISSUE-456
notes: [Candidate validated in staging]
references: [https://example.invalid/releases/1.1.7]
```

Unknown requirement and manual-case IDs produce warnings. Invalid entries do not stop unrelated artifact parsing. Release metadata precedence is CLI (`--release`, `--tested-build`, `--commit-sha`, `--branch`, `--environment`, `--workflow-run`, `--release-date`), then `QR_*`/GitHub Actions variables, then configuration, then the release-scope `release` value as a final fallback.

## Deterministic readiness rules

Failed/broken automated tests, failed/blocked required manual cases, uncovered in-scope requirements, critical/high security findings, and a failed quality gate block a release. Not-run required manual cases and missing evidence warn. Missing scope or all automated results makes readiness incomplete. With no blocker or warning, accepted risks yield **Ready with accepted risks**; otherwise the result is **Ready**. Risk acceptance adds an action but never suppresses its finding.

Every failed quality-gate check produces its own blocker action and readiness reason. Requirement totals separately report covered, uncovered, and explicitly excluded scope entries. A release-scope `release` value that differs from the resolved report release is a blocker and a generation warning.

## Git definition history

Enable `git.enabled`. Commands use explicit arguments, bounded execution, and repository-contained relative paths. File history is labelled `file-level`; unavailable source or Git is `unavailable`. `exact-id` and `source-range` are reserved for future collectors that can prove those mappings. One-case-per-file manual YAML can be interpreted as high-confidence file history, but the collector never claims perfect test-level history from a shared source file.

For complete history in Actions:

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0
```

Shallow and non-Git directories still generate reports; definition history is best-effort and records its limitation.

## Audit package

`normalized-report.json`, copied raw evidence under `raw/`, `evidence-manifest.json`, `checksums.sha256`, and the human-readable static report are included when ZIP output is enabled. The manifest separates included files, external links, missing evidence, and locally drafted (not imported) manual work. It contains no environment dump, token, absolute local path, or authentication data. SHA-256 entries use sorted report-relative paths. The manifest enumerates every regular bundle file except the checksum file and ZIP; `checksums.sha256` verifies every enumerated file plus `evidence-manifest.json`. Requirement totals in the manifest come from release scope rather than the repository-wide requirement set, and the tool version is read from the installed CLI package metadata.

## Project summary and central portfolio

Every report emits versioned `project-quality-summary.json`. Trusted project workflows publish the validated summary to a configured `quality-summaries` branch or repository at `projects/<project-key>/project-quality-summary.json`; see `examples/github-actions/project-summary-producer.yml`. The central workflow checks out that store and runs:

```bash
quality-report portfolio --input summary-store/projects --output portfolio --stale-days 7
```

The generated site embeds local validated data and needs no cross-origin fetch. Ordering is release blocked, failed gate, new failures, persistent failures, required manual work, uncovered requirements, security blockers, slow regressions, historically unstable cases, stale data, warning/incomplete readiness, then healthy. Staleness never outranks an active issue. Report links must use HTTP(S). Duplicate project keys stop generation and identify all conflicting summary paths.

For private summary stores, prefer a GitHub App installation token. A fine-grained PAT is acceptable with only the necessary repository Contents permission. Producers use `QUALITY_SUMMARY_WRITE_TOKEN`; consumers use `QUALITY_SUMMARY_READ_TOKEN`. Neither token is placed in static output.

Historical requirement-state transitions, consecutive uncovered-requirement history, and requirement scope-transition history are deferred. Current requirement traceability and automated/manual/hybrid case links remain available. External links are references, not bundled proof; locally drafted manual executions are not official evidence.
