# Logical test cases and unified executions

The generated report distinguishes an imported result from a logical test case. An imported automated result is one technical implementation in the current run. A logical case groups implementations only by exact canonical identity; automated tests do not need a duplicate YAML definition.

## Catalogue grouping

Canonical ID is the only association key. Matching a requirement, title, tag, source file, or similar wording never merges cases. Exact canonical-ID equality can therefore create:

- **automated** cases, with automated implementations only;
- **manual** cases, with a Git-tracked manual definition only;
- **hybrid** cases, where an automated identity and manual definition use the same canonical ID.

Framework, layer, source, suite, and labels remain implementation metadata. Browser or project variants are shown only when the adapter supplied them. Existing retry normalization remains authoritative: retries already collapsed by the normalizer do not become implementations.

Conflicted explicit identities preserve every implementation and link to Diagnostics. They are marked unstable and do not claim reliable continuity. Display titles are selected deterministically: approved manual title, stable explicit automated title, newest implementation title, then lexical order.

## Current result, stability, and duration

Each implementation selects its latest official available result first. Logical status then uses the most severe active implementation: broken, failed, blocked, not-run, skipped, passed, unknown. A pass cannot hide another implementation's active failure. Draft and deprecated manual definitions do not contribute an active result; only completed, CLI-validated imported manual executions are official.

Stability uses only samples present in the generated report. One sample is reported as **Insufficient history**. A rate always includes its sample size. A passed normalized result with an explicit retry count may be labelled flaky, because its failed attempt and final pass are present in current adapter semantics. No trend is inferred.

Invalid, negative, or missing durations are ignored. Automated durations are test-result durations. Manual execution wall-clock duration is shown on its execution, not mixed into per-case automated timings. Average and median use deterministic rounding and always show sample counts and measurement source.

## Unified executions

The current automated report is one execution, never one per test. Its ID uses existing run/workflow metadata, or a deterministic technical ID derived from stable report metadata. Every completed, validated imported manual execution is a separate execution. Browser-local drafts, imported drafts, unknown cases, and results rejected by existing validation are excluded.

The static routes are:

- `#/tests` and the compatibility alias `#/test-cases`;
- `#/tests/:canonicalId` for logical case details (legacy technical IDs resolve when unambiguous);
- `#/history` and the compatibility alias `#/executions`;
- `#/executions/:executionId`;
- `#/requirements#requirement-:encodedId`;
- `#/downloads` and `#/evidence`.

Route parameters use router encoding and centralized helpers. Requirements, cases, executions, and evidence link to one another. Older manifests without `testCaseCatalogue` or `unifiedExecutions` remain readable: automated cases receive a minimal presentation-only fallback and the executions page shows a focused compatibility message.

## Historical limitations and future work

This version contains the current automated execution and imported manual executions only. It does not download CI artifacts, persist summaries between builds, merge earlier workflow runs, store cross-release trends, or manufacture flaky trends. Those historical summaries and trends are deferred to PR 3. Test-plan editing, Jira synchronization, browser case editing, backend services, user accounts, portfolio history, AI recommendations, and new quality/readiness rules also remain out of scope.
