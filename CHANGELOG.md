# Changelog

This project follows Semantic Versioning. Release candidates may refine documented
contracts before `1.0.0`; stable `1.x` releases preserve public configuration,
normalized report, retained-history, and project-summary contracts unless a
documented migration is provided.

## 1.0.0-rc.1

- Added Git-first compact retained history with attempt-aware executions.
- Added history-aware project summaries and static portfolio generation.
- Finalized manual execution, release-readiness, evidence, checksum, and audit ZIP flows.
- Added trusted self-reporting/Pages deployment and read-only pull-request reporting.
- Hardened history inspection, merge, exact verification, concurrent retry, and first-run behavior.
- Prepared version-matched core, adapters, and CLI tarballs with a clean external-install smoke test.

Migration from `0.1.x`: use Node 22, add a stable `project.key`, configure `history`,
and use `run_id-run_attempt` (or another attempt-aware value) for CI execution IDs.
No backend or database migration is required.
