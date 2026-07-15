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

Unknown requirement and manual-case IDs produce warnings. Invalid entries do not stop unrelated artifact parsing. Release metadata precedence is CLI (`--release`, `--tested-build`, `--commit-sha`, `--branch`, `--environment`, `--workflow-run`, `--release-date`), then `QR_*`/GitHub Actions variables, then configuration.

## Deterministic readiness rules

Failed/broken automated tests, failed/blocked required manual cases, uncovered in-scope requirements, critical/high security findings, and a failed quality gate block a release. Not-run required manual cases and missing evidence warn. Missing scope or all automated results makes readiness incomplete. With no blocker or warning, accepted risks yield **Ready with accepted risks**; otherwise the result is **Ready**. Risk acceptance adds an action but never suppresses its finding.

## Git definition history

Enable `git.enabled`. Commands use explicit arguments, bounded execution, and repository-contained relative paths. File history is labelled `file-level`; unavailable source or Git is `unavailable`. `exact-id` and `source-range` are reserved for future collectors that can prove those mappings. One-case-per-file manual YAML can be interpreted as high-confidence file history, but the collector never claims perfect test-level history from a shared source file.

For complete history in Actions:

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0
```

Shallow and non-Git directories still generate reports; history is best-effort and records its limitation.

## Audit package

`normalized-report.json`, copied raw evidence under `raw/`, `evidence-manifest.json`, `checksums.sha256`, and the human-readable static report are included when ZIP output is enabled. The manifest separates included files, external links, missing evidence, and locally drafted (not imported) manual work. It contains no environment dump, token, absolute local path, or authentication data. SHA-256 entries use sorted report-relative paths.

## Project summary and central portfolio

Every report emits versioned `project-quality-summary.json`. A central workflow downloads those small artifacts and runs:

```bash
quality-report portfolio --input downloaded-summaries --output portfolio --stale-days 7
```

The generated site embeds local validated data and needs no cross-origin fetch. Ordering is blocker, failed gate, manual work, uncovered requirement, new failure, security warning, healthy; stale summaries are escalated and explicitly labelled. Project key/name, patterns, Jira link base, report URL, scope, quality profile, and stale threshold are configuration-driven.

Static limitations: history depends on checkout depth; “new failure” remains zero until comparison input is supplied; external links are references, not bundled proof; locally drafted manual executions are not official evidence. Publish summaries only where their project/release metadata is appropriate to disclose.
